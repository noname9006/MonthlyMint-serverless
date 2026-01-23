import type { NextApiRequest, NextApiResponse } from 'next'
import { checkAdminAuth } from '@/lib/admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Admin-only endpoint - read Discord user ID from header
  const discordUserId = req.headers['x-discord-user-id'] as string
  
  if (!checkAdminAuth(discordUserId)) {
    return res.status(401).json({ error: 'Unauthorized - Admin access required' })
  }

  return res.json({
    success: true,
    isAdmin: true
  })
}
