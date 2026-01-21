/**
 * Admin authentication helpers
 */

/**
 * Get all admin user IDs from environment variables
 * Supports ADMIN1_USERID, ADMIN2_USERID, ADMIN3_USERID, etc.
 */
export function getAdminUserIds(): string[] {
  const adminIds: string[] = []
  let index = 1
  
  // Keep checking for ADMIN{N}_USERID until we don't find one
  while (true) {
    const envVarName = `ADMIN${index}_USERID`
    const adminId = process.env[envVarName]
    
    if (!adminId) {
      break
    }
    
    adminIds.push(adminId.trim())
    index++
  }
  
  return adminIds
}

/**
 * Check if a Discord user ID is an admin
 */
export function isAdmin(discordUserId: string): boolean {
  const adminIds = getAdminUserIds()
  return adminIds.includes(discordUserId)
}

/**
 * Middleware-like function to check admin authentication
 * Returns true if user is admin, false otherwise
 */
export function checkAdminAuth(discordUserId: string | undefined | null): boolean {
  if (!discordUserId) {
    return false
  }
  
  return isAdmin(discordUserId)
}
