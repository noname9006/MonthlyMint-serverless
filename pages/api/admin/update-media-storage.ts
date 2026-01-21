import type { NextApiRequest, NextApiResponse } from 'next'
import { upsertMediaStorage } from '@/lib/db'
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

  const { mediaUpdates } = req.body

  if (!Array.isArray(mediaUpdates) || mediaUpdates.length === 0) {
    return res.status(400).json({ error: 'mediaUpdates array is required' })
  }

  try {
    // Process all updates
    const results = await Promise.all(
      mediaUpdates.map(async (update: { levelName: string; year: number; monthName: string; ipfsCid: string }) => {
        return await upsertMediaStorage(update.levelName, update.year, update.monthName, update.ipfsCid)
      })
    )
    
    return res.json({
      success: true,
      updatedCount: results.length
    })
  } catch (error) {
    console.error('Error updating media storage:', error)
    return res.status(500).json({ error: 'Failed to update media storage' })
  }
}
