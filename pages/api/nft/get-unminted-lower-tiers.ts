import type { NextApiRequest, NextApiResponse } from 'next'
import { getUserMintsForMonth, getCurrentMonthSetting } from '@/lib/db'
import { ROLE_HIERARCHY } from '@/lib/discord'

interface UnmintedLowerTier {
  id: string
  name: string
  priority: number
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { discordId, currentRoleName } = req.body

    if (!discordId || !currentRoleName) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Get current month/year setting
    const currentMonthSetting = await getCurrentMonthSetting()
    if (!currentMonthSetting) {
      return res.status(500).json({ error: 'Current month not configured' })
    }

    const { month_name: monthName, year } = currentMonthSetting

    // Get user mints for current month/year
    const userMints = await getUserMintsForMonth(discordId, year, monthName)
    const mintedRoleNames = new Set(userMints.map(mint => mint.role_name).filter(Boolean))
    
    // Find current role in hierarchy
    const currentRoleIndex = ROLE_HIERARCHY.findIndex(r => r.name === currentRoleName)
    
    if (currentRoleIndex === -1) {
      return res.status(400).json({ error: 'Invalid role name' })
    }

    // Get unminted lower-tier roles (higher priority numbers = lower tier)
    const unmintedLowerTiers: UnmintedLowerTier[] = []
    for (let i = currentRoleIndex + 1; i < ROLE_HIERARCHY.length; i++) {
      const lowerRole = ROLE_HIERARCHY[i]
      if (!mintedRoleNames.has(lowerRole.name)) {
        unmintedLowerTiers.push({
          id: lowerRole.id,
          name: lowerRole.name,
          priority: lowerRole.priority,
        })
      }
    }

    res.json({
      success: true,
      unmintedLowerTiers,
    })
  } catch (error) {
    console.error('Get unminted lower tiers error:', error)
    res.status(500).json({ error: 'Failed to get unminted lower tiers' })
  }
}
