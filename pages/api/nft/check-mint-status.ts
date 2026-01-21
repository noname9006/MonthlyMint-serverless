import type { NextApiRequest, NextApiResponse } from 'next'
import { hasUserMintedForRoleInMonth, getUserMintsForMonth, getCurrentMonthSetting } from '@/lib/db'
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

    // Get current month/year setting
    const currentMonthSetting = await getCurrentMonthSetting()
    if (!currentMonthSetting) {
      return res.status(500).json({ error: 'Current month not configured' })
    }

    const { month_name: monthName, year } = currentMonthSetting

    // Check if user already minted for this role in current month/year
    const alreadyMinted = await hasUserMintedForRoleInMonth(discordId, roleName, year, monthName)
    
    // Get user mints for current month/year to check for lower-tier availability
    const userMints = await getUserMintsForMonth(discordId, year, monthName)
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
