import type { NextApiRequest, NextApiResponse } from 'next'
import { randomUUID } from 'crypto'

import { getDiscordOAuthUrl } from '@/lib/discord'

const STATE_COOKIE = 'discord_oauth_state'
const COOKIE_MAX_AGE = 5 * 60 // 5 минут

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const state = randomUUID()

  res.setHeader(
    'Set-Cookie',
    `${STATE_COOKIE}=${state}; Path=/api/auth/discord; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`
  )

  const url = getDiscordOAuthUrl(state)
  res.redirect(302, url)
}

