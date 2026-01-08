import { kv } from '@vercel/kv'

// Helper function to provide better error messages when KV is not configured
function createKVError(): Error {
  const error = new Error(
    'Vercel KV is not configured. To fix this:\n\n' +
    '1. For Vercel Deployment:\n' +
    '   - Go to your Vercel project dashboard\n' +
    '   - Navigate to the "Storage" tab\n' +
    '   - Click "Create Database" and select "KV"\n' +
    '   - Vercel will automatically set KV_REST_API_URL and KV_REST_API_TOKEN\n\n' +
    '2. For Local Development:\n' +
    '   - Option A: Use Vercel CLI:\n' +
    '     * Run: npm i -g vercel\n' +
    '     * Run: vercel link\n' +
    '     * Run: vercel env pull .env.local\n' +
    '   - Option B: Manual setup:\n' +
    '     * Go to https://vercel.com/dashboard\n' +
    '     * Select your project → Storage → Your KV database\n' +
    '     * Click ".env.local" tab\n' +
    '     * Copy KV_REST_API_URL and KV_REST_API_TOKEN to your .env.local file\n\n' +
    'For more details, see: README.md and DEPLOYMENT.md'
  )
  error.name = 'KVNotConfiguredError'
  return error
}

// Wrapper to catch KV configuration errors and provide helpful messages
async function handleKVOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof Error && error.message.includes('Missing required environment variables')) {
      throw createKVError()
    }
    throw error
  }
}

// User Management Functions

export interface User {
  id: number
  discord_id: string
  discord_username: string | null
  discord_global_name: string | null
  created_at: string
  updated_at: string
}

// Auto-incrementing ID counter
async function getNextUserId(): Promise<number> {
  return handleKVOperation(async () => {
    const id = await kv.incr('user:id:counter')
    return id
  })
}

export async function getUserByDiscordId(discordId: string): Promise<User | null> {
  return handleKVOperation(async () => {
    const user = await kv.get<User>(`user:discord:${discordId}`)
    return user
  })
}

export async function createUser(discordId: string, username?: string, globalName?: string): Promise<User> {
  const id = await getNextUserId()
  const now = new Date().toISOString()
  
  const user: User = {
    id,
    discord_id: discordId,
    discord_username: username || null,
    discord_global_name: globalName || null,
    created_at: now,
    updated_at: now,
  }
  
  // Store user by discord ID and by numeric ID
  await kv.set(`user:discord:${discordId}`, user)
  await kv.set(`user:id:${id}`, user)
  
  return user
}

export async function updateUser(discordId: string, username?: string, globalName?: string): Promise<void> {
  const user = await getUserByDiscordId(discordId)
  if (!user) return
  
  const updatedUser: User = {
    ...user,
    discord_username: username || null,
    discord_global_name: globalName || null,
    updated_at: new Date().toISOString(),
  }
  
  await kv.set(`user:discord:${discordId}`, updatedUser)
  await kv.set(`user:id:${user.id}`, updatedUser)
}

export async function getOrCreateUser(discordId: string, username?: string, globalName?: string): Promise<User> {
  let user = await getUserByDiscordId(discordId)
  
  if (!user) {
    user = await createUser(discordId, username, globalName)
  } else {
    const needsUpdate = 
      (username && user.discord_username !== username) ||
      (globalName && user.discord_global_name !== globalName)
    
    if (needsUpdate) {
      await updateUser(discordId, username, globalName)
      const updatedUser = await getUserByDiscordId(discordId)
      if (updatedUser) {
        user = updatedUser
      }
    }
  }
  
  return user
}

// Discord Authentication Logging

export interface DiscordAuthLog {
  discord_id: string
  user_id: number | null
  action: string
  success: boolean
  error_message?: string
  ip_address?: string
  user_agent?: string
}

async function getNextAuthLogId(): Promise<number> {
  const id = await kv.incr('discord_auth_log:id:counter')
  return id
}

export async function logDiscordAuth(log: DiscordAuthLog): Promise<void> {
  const id = await getNextAuthLogId()
  const timestamp = new Date().toISOString()
  
  const logEntry = {
    id,
    ...log,
    timestamp,
  }
  
  // Store the log entry
  await kv.set(`discord_auth_log:${id}`, logEntry)
  
  // Add to user's log list for querying
  if (log.discord_id) {
    await kv.lpush(`discord_auth_logs:user:${log.discord_id}`, id)
  }
}

// Wallet Connection Logging

export interface WalletConnectLog {
  discord_id?: string
  user_id?: number
  wallet_address?: string
  action: string
  success: boolean
  error_message?: string
  ip_address?: string
  user_agent?: string
}

async function getNextWalletLogId(): Promise<number> {
  const id = await kv.incr('wallet_connect_log:id:counter')
  return id
}

export async function logWalletConnect(log: WalletConnectLog): Promise<void> {
  const id = await getNextWalletLogId()
  const timestamp = new Date().toISOString()
  
  const logEntry = {
    id,
    ...log,
    wallet_address: log.wallet_address ? log.wallet_address.toLowerCase() : null,
    timestamp,
  }
  
  await kv.set(`wallet_connect_log:${id}`, logEntry)
  
  if (log.discord_id) {
    await kv.lpush(`wallet_connect_logs:user:${log.discord_id}`, id)
  }
}

// Discord-Wallet Connection Management

export interface DiscordWalletConnection {
  id: number
  discord_id: string
  user_id: number
  evm_address: string
  connected_at: string
  disconnected_at: string | null
  is_active: number
}

async function getNextConnectionId(): Promise<number> {
  const id = await kv.incr('discord_wallet_connection:id:counter')
  return id
}

export async function createDiscordWalletConnection(discordId: string, userId: number, evmAddress: string): Promise<void> {
  const normalizedAddress = evmAddress.toLowerCase()
  const key = `discord_wallet_connection:${discordId}:${normalizedAddress}`
  
  // Check if connection exists
  const existing = await kv.get<DiscordWalletConnection>(key)
  
  if (existing) {
    // Update existing connection to make it active
    const updated: DiscordWalletConnection = {
      ...existing,
      user_id: userId,
      is_active: 1,
      connected_at: new Date().toISOString(),
      disconnected_at: null,
    }
    await kv.set(key, updated)
  } else {
    // Create new connection
    const id = await getNextConnectionId()
    const connection: DiscordWalletConnection = {
      id,
      discord_id: discordId,
      user_id: userId,
      evm_address: normalizedAddress,
      connected_at: new Date().toISOString(),
      disconnected_at: null,
      is_active: 1,
    }
    await kv.set(key, connection)
  }
  
  // Add to active connections set
  await kv.sadd(`discord_wallet_connections:active:${discordId}`, normalizedAddress)
}

export async function deactivateDiscordWalletConnection(discordId: string, evmAddress: string): Promise<void> {
  const normalizedAddress = evmAddress.toLowerCase()
  const key = `discord_wallet_connection:${discordId}:${normalizedAddress}`
  
  const connection = await kv.get<DiscordWalletConnection>(key)
  if (connection && connection.is_active === 1) {
    const updated: DiscordWalletConnection = {
      ...connection,
      is_active: 0,
      disconnected_at: new Date().toISOString(),
    }
    await kv.set(key, updated)
    
    // Remove from active connections set
    await kv.srem(`discord_wallet_connections:active:${discordId}`, normalizedAddress)
  }
}

export async function getActiveWalletConnections(discordId: string): Promise<DiscordWalletConnection[]> {
  const activeAddresses = await kv.smembers(`discord_wallet_connections:active:${discordId}`)
  
  // Fetch all connections concurrently for better performance
  const connections = await Promise.all(
    activeAddresses.map(address => 
      kv.get<DiscordWalletConnection>(`discord_wallet_connection:${discordId}:${address}`)
    )
  )
  
  // Filter out null values (in case some connections were deleted)
  return connections.filter((conn): conn is DiscordWalletConnection => conn !== null)
}

export async function getActiveWalletConnectionByAddress(discordId: string, evmAddress: string): Promise<DiscordWalletConnection | null> {
  const normalizedAddress = evmAddress.toLowerCase()
  const connection = await kv.get<DiscordWalletConnection>(`discord_wallet_connection:${discordId}:${normalizedAddress}`)
  
  if (connection && connection.is_active === 1) {
    return connection
  }
  
  return null
}

// SBT Mint Event Tracking

export interface SbtMintEvent {
  id?: number
  discord_id: string
  user_id: number
  wallet_address: string
  contract_address: string
  token_id?: string
  transaction_hash: string
  role_name?: string
  credential_type?: string
  metadata?: string
  media_uri?: string
  level?: number
  minted_at?: string
}

async function getNextMintEventId(): Promise<number> {
  const id = await kv.incr('sbt_mint_event:id:counter')
  return id
}

// Log a new mint event
type LogSbtMintResult = 
  | { success: true; alreadyLogged: boolean }
  | { success: false; error: string }

export async function logSbtMint(event: SbtMintEvent): Promise<LogSbtMintResult> {
  try {
    const txKey = `sbt_mint:tx:${event.transaction_hash}`
    
    // Check if transaction already logged (idempotency)
    const existing = await kv.get(txKey)
    
    if (existing) {
      console.log(`Mint already logged for tx: ${event.transaction_hash}`)
      return { success: true, alreadyLogged: true }
    }
    
    const id = await getNextMintEventId()
    const mintEvent = {
      ...event,
      id,
      wallet_address: event.wallet_address.toLowerCase(),
      contract_address: event.contract_address.toLowerCase(),
      minted_at: new Date().toISOString(),
    }
    
    // Store by transaction hash (primary lookup)
    await kv.set(txKey, mintEvent)
    
    // Store by ID
    await kv.set(`sbt_mint_event:${id}`, mintEvent)
    
    // Add to user's mints list
    await kv.lpush(`sbt_mints:user:${event.discord_id}`, id)
    
    // Add to role-specific mints set for the user
    if (event.role_name) {
      await kv.sadd(`sbt_mints:user:${event.discord_id}:role:${event.role_name}`, id)
    }
    
    // Add to contract-specific mints set for the user
    await kv.sadd(`sbt_mints:user:${event.discord_id}:contract:${event.contract_address.toLowerCase()}`, id)
    
    return { success: true, alreadyLogged: false }
  } catch (error) {
    console.error('Error in logSbtMint:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown database error'
    }
  }
}

// Get total mints for a Discord user
export async function getUserMintCount(discordId: string): Promise<number> {
  const count = await kv.llen(`sbt_mints:user:${discordId}`)
  return count
}

// Get all mints for a Discord user
export async function getUserMints(discordId: string): Promise<SbtMintEvent[]> {
  const mintIds = await kv.lrange(`sbt_mints:user:${discordId}`, 0, -1)
  
  // Fetch all mints concurrently for better performance
  const mints = await Promise.all(
    mintIds.map(id => kv.get<SbtMintEvent>(`sbt_mint_event:${id}`))
  )
  
  // Filter out null values (in case some mints were deleted)
  return mints.filter((mint): mint is SbtMintEvent => mint !== null)
}

// Check if user already minted for specific role
export async function hasUserMintedForRole(discordId: string, roleName: string): Promise<boolean> {
  const count = await kv.scard(`sbt_mints:user:${discordId}:role:${roleName}`)
  return count > 0
}

// Check if user already minted for specific contract
export async function hasUserMintedForContract(discordId: string, contractAddress: string): Promise<boolean> {
  const count = await kv.scard(`sbt_mints:user:${discordId}:contract:${contractAddress.toLowerCase()}`)
  return count > 0
}

// Get mint by transaction hash
export async function getMintByTxHash(txHash: string): Promise<SbtMintEvent | null> {
  const mint = await kv.get<SbtMintEvent>(`sbt_mint:tx:${txHash}`)
  return mint
}

// Initialize database (no-op for KV, but kept for compatibility)
export function initDatabase(): void {
  // No initialization needed for Vercel KV
  console.log('Using Vercel KV - no initialization required')
}

// Close database connection (no-op for KV, but kept for compatibility)
export function closeDatabase(): void {
  // No cleanup needed for Vercel KV
}
