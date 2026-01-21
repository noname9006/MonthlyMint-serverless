import type { NextApiRequest, NextApiResponse } from 'next'
import { ethers } from 'ethers'
import { getActiveWalletConnectionByAddress, getUserByDiscordId, hasUserMintedForRole, hasUserMintedForContract, getUserMintCount } from '@/lib/db'
import { chainConfig } from '@/lib/chains'

const BACKEND_PRIVATE_KEY = process.env.BACKEND_PRIVATE_KEY
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_BOTANIST_CONTRACT_ADDRESS || ''

// In-memory cache to track pending mints with expiration
// Note: In serverless environments, each instance maintains its own Map.
// This is acceptable as the goal is to reduce duplicate requests within the same instance.
// The database layer provides the final source of truth for completed mints.
interface PendingMint {
  timestamp: number
  discordId: string  // Stored for debugging and logging purposes
  roleName: string   // Stored for debugging and logging purposes
}

const pendingMints = new Map<string, PendingMint>()
const PENDING_MINT_EXPIRATION_MS = 5 * 60 * 1000 // 5 minutes

// Clean up pending mints older than 5 minutes
function cleanupPendingMints() {
  const now = Date.now()
  const expiredKeys: string[] = []
  
  // Use Array.from() to convert iterator to array for safer iteration
  Array.from(pendingMints.entries()).forEach(([key, pending]) => {
    if (now - pending.timestamp > PENDING_MINT_EXPIRATION_MS) {
      expiredKeys.push(key)
    }
  })
  
  expiredKeys.forEach(key => pendingMints.delete(key))
  
  if (expiredKeys.length > 0) {
    console.log(`Cleaned up ${expiredKeys.length} expired pending mints`)
  }
}

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
    const { userWalletAddress, metadata, mediaURI, credentialType, issuerName, level, discordId, roleName, contractAddress } = req.body

    if (!userWalletAddress || !mediaURI || !credentialType || !issuerName || !level) {
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

    const user = await getUserByDiscordId(discordId)
    if (!user) {
      return res.status(403).json({ error: 'Not verified with Discord' })
    }

    const connection = await getActiveWalletConnectionByAddress(discordId, userWalletAddress)
    if (!connection) {
      return res.status(403).json({ error: 'Wallet not connected to Discord account' })
    }

    // Clean up expired pending mints before checking
    cleanupPendingMints()

    // Check if user has a pending mint for this role (optimistic locking)
    const pendingMintKey = `${discordId}:${roleName}`
    const existingPending = pendingMints.get(pendingMintKey)
    
    if (existingPending) {
      console.log(`User ${discordId} has pending mint for role: ${roleName}`)
      return res.status(403).json({
        error: 'You already have a pending mint for this role. Please wait...',
        code: 'PENDING_MINT'
      })
    }

    // Anti-abuse checks: Check mint history before generating signature
    const MAX_MINTS_PER_USER = 6 // One per role
    
    // Check if user already minted for this specific role
    if (await hasUserMintedForRole(discordId, roleName)) {
      console.log(`User ${discordId} already minted for role: ${roleName}`)
      return res.status(403).json({ 
        error: 'You have already minted an SBT for this role',
        code: 'ALREADY_MINTED_ROLE'
      })
    }

    // Check if user already minted from this specific contract
    if (await hasUserMintedForContract(discordId, contractAddress)) {
      console.log(`User ${discordId} already minted from contract: ${contractAddress}`)
      return res.status(403).json({ 
        error: 'You have already minted an SBT from this contract',
        code: 'ALREADY_MINTED_CONTRACT'
      })
    }

    // Check total mint limit per Discord account
    const totalMints = await getUserMintCount(discordId)
    if (totalMints >= MAX_MINTS_PER_USER) {
      console.log(`User ${discordId} exceeded max mints: ${totalMints}/${MAX_MINTS_PER_USER}`)
      return res.status(403).json({ 
        error: `You have reached the maximum number of SBT mints (${MAX_MINTS_PER_USER})`,
        code: 'MAX_MINTS_EXCEEDED'
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

    // Create message to sign (must match contract logic with nonce)
    const messageHash = ethers.utils.solidityKeccak256(
      ['address', 'string', 'string', 'string', 'string', 'uint256', 'uint256'],
      [userWalletAddress, metadata, mediaURI, credentialType, issuerName, nonce, level]
    )

    // Sign with backend wallet
    const signature = await wallet.signMessage(ethers.utils.arrayify(messageHash))

    // Add to pending mints cache (optimistic locking)
    // Note: This entry will naturally expire after 5 minutes.
    // We don't need to manually remove it on success because once the mint is logged
    // to the database, the hasUserMintedForRole() check (line 103) will block future
    // signature requests before they reach this pending check.
    pendingMints.set(pendingMintKey, {
      timestamp: Date.now(),
      discordId: discordId,
      roleName: roleName
    })

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
      level: level,
    })
  } catch (error) {
    console.error('Signature generation error:', error)
    res.status(500).json({ error: 'Signature generation failed' })
  }
}
