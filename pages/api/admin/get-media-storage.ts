import type { NextApiRequest, NextApiResponse } from 'next'
import { getAllMediaStorageForYearMonth } from '@/lib/db'
import { checkAdminAuth } from '@/lib/admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Admin-only endpoint
  const discordUserId = req.headers['x-discord-user-id'] as string
  
  if (!checkAdminAuth(discordUserId)) {
    return res.status(401).json({ error: 'Unauthorized - Admin access required' })
  }

  const { year, monthName } = req.body

  if (!year || !monthName) {
    return res.status(400).json({ error: 'year and monthName are required' })
  }

  try {
    const mediaStorage = await getAllMediaStorageForYearMonth(year, monthName)
    
    return res.json({
      success: true,
      mediaStorage
    })
  } catch (error) {
    console.error('Error fetching media storage:', error)
    return res.status(500).json({ error: 'Failed to fetch media storage' })
  }
}
