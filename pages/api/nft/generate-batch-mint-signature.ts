import type { NextApiRequest, NextApiResponse } from 'next'
import { ethers } from 'ethers'
import { getActiveWalletConnectionByAddress, getUserByDiscordId, hasUserMintedForRole, getUserMintCount } from '@/lib/db'
import { chainConfig } from '@/lib/chains'

const BACKEND_PRIVATE_KEY = process.env.BACKEND_PRIVATE_KEY
const NFT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || ''

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Validate backend configuration
  if (!BACKEND_PRIVATE_KEY) {
    console.error('BACKEND_PRIVATE_KEY not configured')
    return res.status(500).json({ error: 'Server configuration error' })
  }

  try {
    const { 
      userWalletAddress, 
      discordId, 
      contractAddress,
      mintRequests // Array of { metadata, mediaURI, credentialType, issuerName, roleName, levelName, monthName, year }
    } = req.body

    if (!userWalletAddress || !discordId || !contractAddress || !mintRequests || !Array.isArray(mintRequests)) {
      return res.status(400).json({ error: 'Missing required fields or invalid mintRequests' })
    }

    if (mintRequests.length === 0) {
      return res.status(400).json({ error: 'mintRequests array is empty' })
    }

    if (mintRequests.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 mints per batch' })
    }

    // Verify Discord user and wallet connection
    const user = await getUserByDiscordId(discordId)
    if (!user) {
      return res.status(403).json({ error: 'Not verified with Discord' })
    }

    const connection = await getActiveWalletConnectionByAddress(discordId, userWalletAddress)
    if (!connection) {
      return res.status(403).json({ error: 'Wallet not connected to Discord account' })
    }

    // Check total mint limit
    const MAX_MINTS_PER_USER = 6
    const totalMints = await getUserMintCount(discordId)
    if (totalMints + mintRequests.length > MAX_MINTS_PER_USER) {
      return res.status(403).json({ 
        error: `Batch would exceed maximum mints (${MAX_MINTS_PER_USER}). You have ${totalMints} mints, requesting ${mintRequests.length} more.`,
        code: 'MAX_MINTS_EXCEEDED'
      })
    }

    // Check if any requested roles are already minted
    for (const request of mintRequests) {
      if (await hasUserMintedForRole(discordId, request.roleName)) {
        return res.status(403).json({ 
          error: `You have already minted an NFT for the ${request.roleName} role`,
          code: 'ALREADY_MINTED_ROLE'
        })
      }
    }

    // Get current nonce from contract
    const provider = new ethers.providers.JsonRpcProvider(chainConfig.rpcUrl)
    const contract = new ethers.Contract(
      contractAddress,
      ['function nonces(address) view returns (uint256)'],
      provider
    )
    
    let startNonce
    try {
      startNonce = await contract.nonces(userWalletAddress)
    } catch (error) {
      console.error('Failed to fetch nonce:', error)
      return res.status(500).json({ error: 'Failed to fetch nonce from contract' })
    }

    // Create wallet for signing
    const wallet = new ethers.Wallet(BACKEND_PRIVATE_KEY)

    // Create EIP-712 domain
    const domain = {
      name: 'Botanist Collection',
      version: '1',
      chainId: chainConfig.id,
      verifyingContract: contractAddress
    }

    // Create EIP-712 types
    const types = {
      Mint: [
        { name: 'to', type: 'address' },
        { name: 'metadata', type: 'string' },
        { name: 'mediaURI', type: 'string' },
        { name: 'credentialType', type: 'string' },
        { name: 'issuerName', type: 'string' },
        { name: 'nonce', type: 'uint256' },
        { name: 'levelName', type: 'string' },
        { name: 'monthName', type: 'string' },
        { name: 'year', type: 'uint256' },
        { name: 'requestId', type: 'bytes32' }
      ]
    }

    // Generate signatures for each mint request
    const signatures = []
    const requestIds = []
    const metadatas = []
    const mediaURIs = []
    const credentialTypes = []
    const issuerNames = []
    const levelNames = []
    const monthNames = []
    const years = []

    for (let i = 0; i < mintRequests.length; i++) {
      const request = mintRequests[i]
      
      // Validate each request
      if (!request.metadata || !request.mediaURI || !request.credentialType || 
          !request.issuerName || !request.levelName || !request.monthName || !request.year) {
        return res.status(400).json({ error: `Invalid mint request at index ${i}` })
      }

      if (!request.mediaURI.startsWith('ipfs://')) {
        return res.status(400).json({ error: `Invalid IPFS URI at index ${i}` })
      }

      const currentNonce = startNonce.toNumber() + i

      // Generate unique request ID
      const requestId = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'uint256', 'bytes32'],
          [userWalletAddress, currentNonce, Date.now() + i, ethers.utils.randomBytes(32)]
        )
      )

      // Create message to sign
      const message = {
        to: userWalletAddress,
        metadata: request.metadata,
        mediaURI: request.mediaURI,
        credentialType: request.credentialType,
        issuerName: request.issuerName,
        nonce: currentNonce,
        levelName: request.levelName,
        monthName: request.monthName,
        year: request.year,
        requestId: requestId
      }

      // Sign with EIP-712
      const signature = await wallet._signTypedData(domain, types, message)

      signatures.push(signature)
      requestIds.push(requestId)
      metadatas.push(request.metadata)
      mediaURIs.push(request.mediaURI)
      credentialTypes.push(request.credentialType)
      issuerNames.push(request.issuerName)
      levelNames.push(request.levelName)
      monthNames.push(request.monthName)
      years.push(request.year)
    }

    console.log(`Generated ${signatures.length} batch signatures for user ${discordId}`)

    res.json({
      success: true,
      signatures,
      requestIds,
      metadatas,
      mediaURIs,
      credentialTypes,
      issuerNames,
      levelNames,
      monthNames,
      years,
      startNonce: startNonce.toNumber(),
      count: mintRequests.length
    })
  } catch (error) {
    console.error('Batch signature generation error:', error)
    res.status(500).json({ error: 'Batch signature generation failed' })
  }
}
