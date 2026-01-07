import type { NextApiRequest, NextApiResponse } from 'next'
import { hasUserMintedForRole, getUserMints } from '@/lib/db'
import { ROLE_HIERARCHY } from '@/lib/discord'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { discordId, roleName } = req.body

    if (!discordId || !roleName) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Check if user already minted for this role
    const alreadyMinted = await hasUserMintedForRole(discordId, roleName)
    
    // Get all user mints to check for lower-tier availability
    const userMints = await getUserMints(discordId)
    const mintedRoleNames = new Set(userMints.map(mint => mint.role_name).filter(Boolean))
    
    // Find current role in hierarchy
    const currentRoleIndex = ROLE_HIERARCHY.findIndex(r => r.name === roleName)
    
    // Check if there are unminted lower-tier roles
    let hasLowerTierAvailable = false
    if (currentRoleIndex !== -1) {
      // Lower tier roles have higher priority numbers (appear later in array)
      for (let i = currentRoleIndex + 1; i < ROLE_HIERARCHY.length; i++) {
        const lowerRole = ROLE_HIERARCHY[i]
        if (!mintedRoleNames.has(lowerRole.name)) {
          hasLowerTierAvailable = true
          break
        }
      }
    }

    res.json({
      success: true,
      alreadyMinted,
      hasLowerTierAvailable,
    })
  } catch (error) {
    console.error('Check mint status error:', error)
    res.status(500).json({ error: 'Failed to check mint status' })
  }
}
