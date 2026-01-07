import type { NextApiRequest, NextApiResponse } from 'next'

import { getUserByDiscordId, logWalletConnect, createDiscordWalletConnection, deactivateDiscordWalletConnection } from '@/lib/db'

// Helper to extract IP address from request
function getIpAddress(req: NextApiRequest): string | undefined {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }
  return req.socket.remoteAddress
}

// Helper to extract user agent from request
function getUserAgent(req: NextApiRequest): string | undefined {
  return req.headers['user-agent']
}

type RequestBody = {
  discordId?: string
  walletAddress?: string
  action?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { discordId, walletAddress, action } = req.body as RequestBody

  if (!action) {
    return res.status(400).json({ error: 'Missing required field: action' })
  }

  const ipAddress = getIpAddress(req)
  const userAgent = getUserAgent(req)

  try {
    // Get user from database if discordId is provided
    let user = discordId ? await getUserByDiscordId(discordId) : null

    // Log wallet connection action
    await logWalletConnect({
      discord_id: discordId,
      user_id: user?.id,
      wallet_address: walletAddress,
      action,
      success: true,
      ip_address: ipAddress,
      user_agent: userAgent,
    })

    // Handle wallet connection
    if (action === 'connected' && discordId && walletAddress && user) {
      await createDiscordWalletConnection(discordId, user.id, walletAddress)
    } else if (action === 'disconnected' && discordId && walletAddress) {
      await deactivateDiscordWalletConnection(discordId, walletAddress)
    }

    return res.status(200).json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to log wallet action'
    
    // Log failed wallet action
    try {
      await logWalletConnect({
        discord_id: discordId,
        user_id: undefined,
        wallet_address: walletAddress,
        action,
        success: false,
        error_message: message,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
    } catch (logError) {
      console.error('Failed to log wallet error:', logError)
    }
    
    return res.status(500).json({ error: message })
  }
}
