import type { NextApiRequest, NextApiResponse } from 'next'
import { getUserByDiscordId, logNftMint, getMintByTxHash } from '@/lib/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      discordId,
      walletAddress,
      contractAddress,
      transactionHash,
      tokenId,
      roleName,
      credentialType,
      metadata,
      mediaUri,
      levelName,
      monthName,
      year,
      requestId,
    } = req.body

    // Validate required fields
    if (!discordId) {
      return res.status(400).json({ error: 'Discord ID is required' })
    }

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' })
    }

    if (!contractAddress) {
      return res.status(400).json({ error: 'Contract address is required' })
    }

    if (!transactionHash) {
      return res.status(400).json({ error: 'Transaction hash is required' })
    }

    // Verify the Discord user exists in the database
    const user = await getUserByDiscordId(discordId)
    if (!user) {
      return res.status(404).json({ error: 'Discord user not found' })
    }

    // Log the mint event - now returns status
    const result = await logNftMint({
      discord_id: discordId,
      user_id: user.id,
      wallet_address: walletAddress,
      contract_address: contractAddress,
      transaction_hash: transactionHash,
      token_id: tokenId,
      role_name: roleName,
      credential_type: credentialType,
      metadata: metadata,
      media_uri: mediaUri,
      level_name: levelName,
      month_name: monthName,
      year: year,
      request_id: requestId,
    })

    if (!result.success) {
      console.error(`Failed to log mint for user ${discordId}, tx: ${transactionHash}:`, result.error)
      return res.status(500).json({ 
        success: false,
        error: result.error || 'Failed to log mint event to database'
      })
    }

    // Double-check verification: Ensure the transaction is actually in the database
    // This provides additional safety in race condition scenarios where multiple requests
    // might attempt to log the same transaction simultaneously
    const verifyMint = await getMintByTxHash(transactionHash)
    if (!verifyMint) {
      console.error(`Verification failed: Mint not found in database for tx: ${transactionHash}`)
      return res.status(500).json({ 
        success: false,
        error: 'Database verification failed - mint event not found after insert'
      })
    }

    console.log(`Logged mint for user ${discordId}, tx: ${transactionHash}`)

    res.json({
      success: true,
      message: result.alreadyLogged ? 'Mint event already logged' : 'Mint event logged successfully',
      alreadyLogged: result.alreadyLogged || false,
    })
  } catch (error) {
    console.error('Error logging mint event:', error)
    res.status(500).json({ error: 'Failed to log mint event' })
  }
}
