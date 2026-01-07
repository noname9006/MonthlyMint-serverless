import type { NextApiRequest, NextApiResponse } from 'next'

import { exchangeCodeForToken, getDiscordUser, getGuildMember, getHighestRole } from '@/lib/discord'
import { getOrCreateUser, logDiscordAuth } from '@/lib/db'

const STATE_COOKIE = 'discord_oauth_state'

// Helper to extract IP address from request
function getIpAddress(req: NextApiRequest): string | undefined {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }
  return req.socket.remoteAddress
}

// Helper to extract user agent from request
function getUserAgent(req: NextApiRequest): string | undefined {
  return req.headers['user-agent']
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const code = typeof req.query.code === 'string' ? req.query.code : null
  const state = typeof req.query.state === 'string' ? req.query.state : null

  if (!code) {
    return res.status(400).send('Missing "code" parameter')
  }

  const storedState = req.cookies?.[STATE_COOKIE]
  if (!state || !storedState || state !== storedState) {
    return renderClosePage(res, { status: 'error', error: 'Invalid state. Please start login again.' })
  }

  // удалить одноразовый state
  res.setHeader('Set-Cookie', `${STATE_COOKIE}=deleted; Path=/api/auth/discord; Max-Age=0; SameSite=Lax`)

  const ipAddress = getIpAddress(req)
  const userAgent = getUserAgent(req)

  try {
    const accessToken = await exchangeCodeForToken(code)
    const user = await getDiscordUser(accessToken)
    const member = await getGuildMember(accessToken)
    const highestRole = member?.roles ? getHighestRole(member.roles) : null

    // Create or update user in database
    const dbUser = await getOrCreateUser(
      user.id,
      user.username,
      user.global_name
    )

    // Log successful authentication
    await logDiscordAuth({
      discord_id: user.id,
      user_id: dbUser.id,
      action: 'oauth_callback',
      success: true,
      ip_address: ipAddress,
      user_agent: userAgent,
    })

    return renderClosePage(res, {
      status: 'success',
      user,
      member,
      highestRole,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Could not authenticate'
    
    // Log failed authentication (we may not have discord_id in case of early failure)
    try {
      await logDiscordAuth({
        discord_id: 'unknown',
        user_id: null,
        action: 'oauth_callback',
        success: false,
        error_message: message,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
    } catch (logError) {
      console.error('Failed to log authentication error:', logError)
    }
    
    return renderClosePage(res, { status: 'error', error: message })
  }
}

type ClosePayload =
  | { status: 'success'; user: unknown; member: unknown; highestRole: unknown }
  | { status: 'error'; error: string }

function renderClosePage(res: NextApiResponse, payload: ClosePayload) {
  const redirect = process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/api/auth/discord/callback'
  const targetOrigin = safeOrigin(redirect) || '*'
  const message = JSON.stringify({ source: 'discord-auth', ...payload })

  const html = `<!doctype html>
<html>
  <body style="background:#0f172a; color:#e2e8f0; font-family:Inter,system-ui,sans-serif;">
    <p>You can close this window.</p>
    <script>
      const payload = ${message};
      try {
        if (window.opener) {
          window.opener.postMessage(payload, '${targetOrigin}');
        }
      } catch (err) {
        console.error('postMessage failed', err);
      }
      window.close();
    </script>
  </body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.status(200).send(html)
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

