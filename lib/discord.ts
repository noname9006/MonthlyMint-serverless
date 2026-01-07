export const DISCORD_CONFIG = {
  guildId: '937915188903018498',
  clientId: process.env.DISCORD_CLIENT_ID || process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '',
  clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
  redirectUri: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/api/auth/discord/callback',
}

// Role hierarchy from highest to lowest priority
export const ROLE_HIERARCHY = [
  { id: '1145967160179560479', name: 'Botanist', priority: 1 },
  { id: '1145963992368566333', name: 'Hyperion Ambassador', priority: 2 },
  { id: '1145966146663759973', name: 'Sequoia Ambassador', priority: 3 },
  { id: '1145962476404478003', name: 'Blossom Ambassador', priority: 4 },
  { id: '937917789916774440', name: 'Seedling Ambassador', priority: 5 },
  { id: '1146225897133842593', name: 'Sprout', priority: 6 },
] as const

export type RoleName = typeof ROLE_HIERARCHY[number]['name']

export function getHighestRole(userRoleIds: string[]): typeof ROLE_HIERARCHY[number] | null {
  for (const role of ROLE_HIERARCHY) {
    if (userRoleIds.includes(role.id)) {
      return role
    }
  }
  return null
}

export function getDiscordOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: DISCORD_CONFIG.clientId,
    redirect_uri: DISCORD_CONFIG.redirectUri,
    response_type: 'code',
    scope: 'identify guilds guilds.members.read',
    state,
  })
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: DISCORD_CONFIG.clientId,
      client_secret: DISCORD_CONFIG.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: DISCORD_CONFIG.redirectUri,
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error_description || data.error || `Token exchange failed: ${response.status}`)
  }
  return data.access_token
}

export async function getDiscordUser(accessToken: string) {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Failed to fetch user: ${res.status} ${body}`)
  }
  return res.json()
}

/**
 * Uses the user's OAuth access token to fetch member info for the configured guild.
 * Returns `null` if the user is not a member (404).
 * Throws with descriptive message for other non-OK responses (401/403/429 etc).
 */
export async function getGuildMember(accessToken: string) {
  const guildId = DISCORD_CONFIG.guildId
  const url = `https://discord.com/api/users/@me/guilds/${guildId}/member`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (res.status === 404) {
    // not a member
    return null
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    // throw a helpful error that includes status + body so server logs show exact reason
    throw new Error(`Failed to fetch guild member: ${res.status} ${body}`)
  }
  return res.json()
}