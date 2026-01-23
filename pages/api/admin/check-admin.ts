import type { NextApiRequest, NextApiResponse } from 'next'
import { validateAdminSession } from '@/lib/session'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Validate admin session
  const discordUserId = await validateAdminSession(req)
  
  if (!discordUserId) {
    return res.status(401).json({ error: 'Unauthorized - Admin access required' })
  }

  return res.json({
    success: true,
    isAdmin: true,
    discordUserId
  })
}
