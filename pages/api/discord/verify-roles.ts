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

    // For role verification, we would need to fetch current roles from Discord
    // However, we don't have an access token stored for security reasons
    // The actual role check happens server-side during mint signature generation
    // This endpoint serves as a user existence check
    
    // Note: In a production environment, you would want to:
    // 1. Store refresh tokens securely (encrypted in DB)
    // 2. Use refresh tokens to get new access tokens
    // 3. Fetch current roles from Discord API with the access token
    
    res.json({
      success: true,
      userExists: true,
      rolesVerified: false, // Roles NOT verified here
      message: 'User exists in database. Roles will be verified server-side during minting.'
    })
  } catch (error) {
    console.error('Error verifying Discord roles:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to verify Discord roles' 
    })
  }
}
