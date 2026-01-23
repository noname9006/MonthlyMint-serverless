import type { NextApiRequest, NextApiResponse } from 'next'
import { ethers } from 'ethers'
import { getActiveWalletConnectionByAddress, getUserByDiscordId, hasUserMintedForTier } from '@/lib/db'
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
      metadata, 
      mediaURI, 
      credentialType, 
      issuerName, 
      discordId, 
      roleName, 
      contractAddress,
      levelName,
      monthName,
      year
    } = req.body

    // Allow empty strings for metadata and credentialType (backward compatibility)
    if (!userWalletAddress || !mediaURI || credentialType === undefined || credentialType === null || !issuerName) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Validate mediaURI is an IPFS URI
    if (!mediaURI.startsWith('ipfs://')) {
      return res.status(400).json({ error: 'Valid IPFS media URI required' })
    }

    // Verify Discord user and wallet connection
    if (!discordId) {
      return res.status(400).json({ error: 'Discord ID required' })
    }

    // Validate roleName and contractAddress
    if (!roleName) {
      return res.status(400).json({ error: 'Role name required' })
    }

    if (!contractAddress) {
      return res.status(400).json({ error: 'Contract address required' })
    }

    // Validate new required fields
    if (!levelName || !monthName || !year) {
      return res.status(400).json({ error: 'levelName, monthName, and year are required' })
    }

    const user = await getUserByDiscordId(discordId)
    if (!user) {
      return res.status(403).json({ error: 'Not verified with Discord' })
    }

    const connection = await getActiveWalletConnectionByAddress(discordId, userWalletAddress)
    if (!connection) {
      return res.status(403).json({ error: 'Wallet not connected to Discord account' })
    }

    // Anti-abuse checks: Check if user already minted this specific tier (levelName + year + monthName)
    if (await hasUserMintedForTier(discordId, levelName, year, monthName)) {
      console.log(`User ${discordId} already minted tier: ${levelName} - ${monthName} ${year}`)
      return res.status(403).json({ 
        error: `You have already minted an NFT for ${levelName} - ${monthName} ${year}`,
        code: 'ALREADY_MINTED_TIER'
      })
    }

    // Get current nonce for the user from the contract
    const provider = new ethers.providers.JsonRpcProvider(chainConfig.rpcUrl)
    const contract = new ethers.Contract(
      contractAddress,
      ['function nonces(address) view returns (uint256)'],
      provider
    )
    
    let nonce
    try {
      nonce = await contract.nonces(userWalletAddress)
    } catch (error) {
      console.error('Failed to fetch nonce:', error)
      return res.status(500).json({ error: 'Failed to fetch nonce from contract' })
    }

    // Create wallet for signing
    const wallet = new ethers.Wallet(BACKEND_PRIVATE_KEY)

    // Generate unique request ID
    const requestId = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'uint256', 'bytes32'],
        [userWalletAddress, nonce, Date.now(), ethers.utils.randomBytes(32)]
      )
    )

    // Create EIP-712 domain
    const domain = {
      name: 'Botanix Ambassador',
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
        { name: 'yearValue', type: 'uint256' },
        { name: 'requestId', type: 'bytes32' }
      ]
    }

    // Create message to sign
    const message = {
      to: userWalletAddress,
      metadata: metadata,
      mediaURI: mediaURI,
      credentialType: credentialType,
      issuerName: issuerName,
      nonce: nonce.toNumber(),
      levelName: levelName,
      monthName: monthName,
      yearValue: year,
      requestId: requestId
    }

    // Sign with EIP-712
    const signature = await wallet._signTypedData(domain, types, message)

    // Log signature generation
    console.log(`Generated signature for user ${discordId}, role ${roleName}, wallet ${userWalletAddress}`)

    res.json({
      success: true,
      signature: signature,
      userWalletAddress: userWalletAddress,
      metadata: metadata,
      mediaURI: mediaURI,
      credentialType: credentialType,
      issuerName: issuerName,
      nonce: nonce.toNumber(),
      levelName: levelName,
      monthName: monthName,
      year: year,
      requestId: requestId
    })
  } catch (error) {
    console.error('Signature generation error:', error)
    res.status(500).json({ error: 'Signature generation failed' })
  }
}
