import { randomBytes } from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { 
  createAdminSession, 
  getAdminSession, 
  touchAdminSession,
  deleteAdminSession 
} from './db'
import { checkAdminAuth } from './admin'

// Session configuration
const SESSION_COOKIE_NAME = 'admin_session'
const SESSION_DURATION_HOURS = 24 // 24 hours session duration

/**
 * Generate a cryptographically secure session token
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Set session cookie
 */
export function setSessionCookie(res: NextApiResponse, sessionToken: string): void {
  const maxAge = SESSION_DURATION_HOURS * 60 * 60 // Convert to seconds
  const isProduction = process.env.NODE_ENV === 'production'
  
  // Use Secure flag in production (requires HTTPS)
  // In development, Secure is optional to allow local testing without HTTPS
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${isProduction ? '; Secure' : ''}`
  )
}

/**
 * Clear session cookie
 */
export function clearSessionCookie(res: NextApiResponse): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=deleted; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`
  )
}

/**
 * Get session token from request cookies
 */
export function getSessionToken(req: NextApiRequest): string | null {
  return req.cookies[SESSION_COOKIE_NAME] || null
}

/**
 * Extract IP address from request
 */
export function getIpAddress(req: NextApiRequest): string | undefined {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }
  return req.socket.remoteAddress
}

/**
 * Extract user agent from request
 */
export function getUserAgent(req: NextApiRequest): string | undefined {
  return req.headers['user-agent']
}

/**
 * Create an admin session
 */
export async function createSession(
  res: NextApiResponse,
  discordId: string,
  userId: number,
  req: NextApiRequest
): Promise<string> {
  // Generate session token
  const sessionToken = generateSessionToken()
  
  // Calculate expiration
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + SESSION_DURATION_HOURS)
  
  // Create session in database
  await createAdminSession(
    sessionToken,
    discordId,
    userId,
    expiresAt,
    getIpAddress(req),
    getUserAgent(req)
  )
  
  // Set cookie
  setSessionCookie(res, sessionToken)
  
  return sessionToken
}

/**
 * Validate session and return Discord ID if valid
 * Returns null if session is invalid or user is not an admin
 */
export async function validateAdminSession(req: NextApiRequest): Promise<string | null> {
  const sessionToken = getSessionToken(req)
  
  if (!sessionToken) {
    return null
  }
  
  try {
    // Get session from database
    const session = await getAdminSession(sessionToken)
    
    if (!session) {
      return null
    }
    
    // Verify user is still an admin
    const isStillAdmin = checkAdminAuth(session.discord_id)
    
    if (!isStillAdmin) {
      // User is no longer an admin, delete the session
      try {
        await deleteAdminSession(sessionToken)
      } catch (deleteError) {
        // Log error without sensitive details
        console.error('Failed to delete invalid admin session')
      }
      return null
    }
    
    // Update last accessed timestamp
    await touchAdminSession(sessionToken)
    
    return session.discord_id
  } catch (error) {
    // Log error type without sensitive session details
    console.error('Error validating admin session:', error instanceof Error ? error.message : 'Unknown error')
    return null
  }
}

/**
 * Destroy session (logout)
 */
export async function destroySession(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const sessionToken = getSessionToken(req)
  
  if (sessionToken) {
    await deleteAdminSession(sessionToken)
  }
  
  clearSessionCookie(res)
}
