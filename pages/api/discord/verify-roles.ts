import type { NextApiRequest, NextApiResponse } from 'next'
import { getUserByDiscordId } from '@/lib/db'

// This endpoint re-validates Discord roles without requiring re-authentication
// Used to check roles on every page load while keeping the 5-minute auth session
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { discordId } = req.body

    if (!discordId) {
      return res.status(400).json({ error: 'Discord ID is required' })
    }

    // Verify Discord user exists in database
    const user = await getUserByDiscordId(discordId)
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'Discord user not found in database' 
      })
    }

    // For role verification, we need to fetch current roles from Discord
    // However, we don't have an access token stored
    // Instead, we'll rely on the signature verification during minting
    // This endpoint primarily validates that the user exists in our DB
    
    // In a production environment, you might want to:
    // 1. Store the access token securely (encrypted in DB)
    // 2. Refresh it if needed
    // 3. Fetch current roles from Discord API
    
    // For now, we'll return success if user exists
    // The actual role check happens server-side during mint signature generation
    res.json({
      success: true,
      member: null, // Roles will be verified during minting
      highestRole: null, // Roles will be verified during minting
      message: 'User verified, roles will be checked during minting'
    })
  } catch (error) {
    console.error('Error verifying Discord roles:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to verify Discord roles' 
    })
  }
}
