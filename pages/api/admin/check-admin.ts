import type { NextApiRequest, NextApiResponse } from 'next'
import { checkAdminAuth } from '@/lib/admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { discordUserId } = req.body

  if (!discordUserId) {
    return res.status(400).json({ error: 'discordUserId is required' })
  }

  const isAdmin = checkAdminAuth(discordUserId)

  return res.json({
    success: true,
    isAdmin
  })
}
