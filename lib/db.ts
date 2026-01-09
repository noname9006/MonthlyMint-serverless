import { neon } from '@neondatabase/serverless'

// Get database connection string from environment
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL environment variable is not set.\n\n' +
    'To fix this:\n' +
    '1. Create a Neon database at https://neon.tech\n' +
    '2. Copy the connection string from the Neon dashboard\n' +
    '3. Add DATABASE_URL to your .env.local file\n' +
    '4. For Vercel deployment, add DATABASE_URL to environment variables\n\n' +
    'For more details, see README.md'
  )
}

// Create a SQL client
const sql = neon(DATABASE_URL)

// Helper function to ensure database schema exists
export async function initDatabase(): Promise<void> {
  try {
    // Create tables if they don't exist
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        discord_id TEXT UNIQUE NOT NULL,
        discord_username TEXT,
        discord_global_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS discord_auth_logs (
        id SERIAL PRIMARY KEY,
        discord_id TEXT NOT NULL,
        user_id INTEGER REFERENCES users(id),
        action TEXT NOT NULL,
        success BOOLEAN NOT NULL,
        error_message TEXT,
        ip_address TEXT,
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS wallet_connect_logs (
        id SERIAL PRIMARY KEY,
        discord_id TEXT,
        user_id INTEGER REFERENCES users(id),
        wallet_address TEXT,
        action TEXT NOT NULL,
        success BOOLEAN NOT NULL,
        error_message TEXT,
        ip_address TEXT,
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS discord_wallet_connections (
        id SERIAL PRIMARY KEY,
        discord_id TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id),
        evm_address TEXT NOT NULL,
        connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        disconnected_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        UNIQUE (discord_id, evm_address)
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS sbt_mint_events (
        id SERIAL PRIMARY KEY,
        discord_id TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id),
        wallet_address TEXT NOT NULL,
        contract_address TEXT NOT NULL,
        token_id TEXT,
        transaction_hash TEXT UNIQUE NOT NULL,
        role_name TEXT,
        credential_type TEXT,
        metadata TEXT,
        media_uri TEXT,
        level INTEGER,
        minted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_discord_auth_logs_discord_id ON discord_auth_logs(discord_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_wallet_connect_logs_discord_id ON wallet_connect_logs(discord_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_discord_wallet_connections_discord_id ON discord_wallet_connections(discord_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_discord_wallet_connections_active ON discord_wallet_connections(discord_id, is_active)`
    await sql`CREATE INDEX IF NOT EXISTS idx_sbt_mint_events_discord_id ON sbt_mint_events(discord_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_sbt_mint_events_tx_hash ON sbt_mint_events(transaction_hash)`
    await sql`CREATE INDEX IF NOT EXISTS idx_sbt_mint_events_wallet ON sbt_mint_events(wallet_address)`
    await sql`CREATE INDEX IF NOT EXISTS idx_sbt_mint_events_contract ON sbt_mint_events(contract_address)`

    console.log('Database schema initialized successfully')
  } catch (error) {
    console.error('Error initializing database:', error)
    throw error
  }
}

// Auto-initialize on first import (in development)
if (process.env.NODE_ENV !== 'production') {
  initDatabase().catch(console.error)
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

export async function getUserByDiscordId(discordId: string): Promise<User | null> {
  const result = await sql`
    SELECT * FROM users WHERE discord_id = ${discordId}
  `
  return result.length > 0 ? (result[0] as User) : null
}

export async function createUser(discordId: string, username?: string, globalName?: string): Promise<User> {
  const result = await sql`
    INSERT INTO users (discord_id, discord_username, discord_global_name)
    VALUES (${discordId}, ${username || null}, ${globalName || null})
    RETURNING *
  `
  return result[0] as User
}

export async function updateUser(discordId: string, username?: string, globalName?: string): Promise<void> {
  await sql`
    UPDATE users
    SET discord_username = ${username || null},
        discord_global_name = ${globalName || null},
        updated_at = CURRENT_TIMESTAMP
    WHERE discord_id = ${discordId}
  `
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

export async function logDiscordAuth(log: DiscordAuthLog): Promise<void> {
  await sql`
    INSERT INTO discord_auth_logs (discord_id, user_id, action, success, error_message, ip_address, user_agent)
    VALUES (
      ${log.discord_id},
      ${log.user_id || null},
      ${log.action},
      ${log.success},
      ${log.error_message || null},
      ${log.ip_address || null},
      ${log.user_agent || null}
    )
  `
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

export async function logWalletConnect(log: WalletConnectLog): Promise<void> {
  await sql`
    INSERT INTO wallet_connect_logs (discord_id, user_id, wallet_address, action, success, error_message, ip_address, user_agent)
    VALUES (
      ${log.discord_id || null},
      ${log.user_id || null},
      ${log.wallet_address ? log.wallet_address.toLowerCase() : null},
      ${log.action},
      ${log.success},
      ${log.error_message || null},
      ${log.ip_address || null},
      ${log.user_agent || null}
    )
  `
}

// Discord-Wallet Connection Management

export interface DiscordWalletConnection {
  id: number
  discord_id: string
  user_id: number
  evm_address: string
  connected_at: string
  disconnected_at: string | null
  is_active: boolean
}

export async function createDiscordWalletConnection(discordId: string, userId: number, evmAddress: string): Promise<void> {
  const normalizedAddress = evmAddress.toLowerCase()
  
  // Check if connection exists
  const existing = await sql`
    SELECT id FROM discord_wallet_connections
    WHERE discord_id = ${discordId} AND evm_address = ${normalizedAddress}
  `
  
  if (existing.length > 0) {
    // Update existing connection to make it active
    await sql`
      UPDATE discord_wallet_connections
      SET is_active = TRUE,
          user_id = ${userId},
          connected_at = CURRENT_TIMESTAMP,
          disconnected_at = NULL
      WHERE discord_id = ${discordId} AND evm_address = ${normalizedAddress}
    `
  } else {
    // Create new connection
    await sql`
      INSERT INTO discord_wallet_connections (discord_id, user_id, evm_address)
      VALUES (${discordId}, ${userId}, ${normalizedAddress})
    `
  }
}

export async function deactivateDiscordWalletConnection(discordId: string, evmAddress: string): Promise<void> {
  const normalizedAddress = evmAddress.toLowerCase()
  await sql`
    UPDATE discord_wallet_connections
    SET is_active = FALSE,
        disconnected_at = CURRENT_TIMESTAMP
    WHERE discord_id = ${discordId} AND evm_address = ${normalizedAddress} AND is_active = TRUE
  `
}

export async function getActiveWalletConnections(discordId: string): Promise<DiscordWalletConnection[]> {
  const result = await sql`
    SELECT * FROM discord_wallet_connections
    WHERE discord_id = ${discordId} AND is_active = TRUE
  `
  return result as DiscordWalletConnection[]
}

export async function getActiveWalletConnectionByAddress(discordId: string, evmAddress: string): Promise<DiscordWalletConnection | null> {
  const normalizedAddress = evmAddress.toLowerCase()
  const result = await sql`
    SELECT * FROM discord_wallet_connections
    WHERE discord_id = ${discordId} AND evm_address = ${normalizedAddress} AND is_active = TRUE
  `
  return result.length > 0 ? (result[0] as DiscordWalletConnection) : null
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

// Log a new mint event
type LogSbtMintResult = 
  | { success: true; alreadyLogged: boolean }
  | { success: false; error: string }

export async function logSbtMint(event: SbtMintEvent): Promise<LogSbtMintResult> {
  try {
    // Check if transaction already logged (idempotency)
    const existing = await sql`
      SELECT id FROM sbt_mint_events WHERE transaction_hash = ${event.transaction_hash}
    `
    
    if (existing.length > 0) {
      console.log(`Mint already logged for tx: ${event.transaction_hash}`)
      return { success: true, alreadyLogged: true }
    }
    
    // Insert the mint event
    await sql`
      INSERT INTO sbt_mint_events 
      (discord_id, user_id, wallet_address, contract_address, token_id, 
       transaction_hash, role_name, credential_type, metadata, media_uri, level)
      VALUES (
        ${event.discord_id},
        ${event.user_id},
        ${event.wallet_address.toLowerCase()},
        ${event.contract_address.toLowerCase()},
        ${event.token_id || null},
        ${event.transaction_hash},
        ${event.role_name || null},
        ${event.credential_type || null},
        ${event.metadata || null},
        ${event.media_uri || null},
        ${event.level || null}
      )
    `
    
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
  const result = await sql`
    SELECT COUNT(*) as count FROM sbt_mint_events WHERE discord_id = ${discordId}
  `
  return Number(result[0].count)
}

// Get all mints for a Discord user
export async function getUserMints(discordId: string): Promise<SbtMintEvent[]> {
  const result = await sql`
    SELECT * FROM sbt_mint_events 
    WHERE discord_id = ${discordId} 
    ORDER BY minted_at DESC
  `
  return result as SbtMintEvent[]
}

// Check if user already minted for specific role
export async function hasUserMintedForRole(discordId: string, roleName: string): Promise<boolean> {
  const result = await sql`
    SELECT COUNT(*) as count FROM sbt_mint_events 
    WHERE discord_id = ${discordId} AND role_name = ${roleName}
  `
  return Number(result[0].count) > 0
}

// Check if user already minted for specific contract
export async function hasUserMintedForContract(discordId: string, contractAddress: string): Promise<boolean> {
  const result = await sql`
    SELECT COUNT(*) as count FROM sbt_mint_events 
    WHERE discord_id = ${discordId} AND contract_address = ${contractAddress.toLowerCase()}
  `
  return Number(result[0].count) > 0
}

// Get mint by transaction hash
export async function getMintByTxHash(txHash: string): Promise<SbtMintEvent | null> {
  const result = await sql`
    SELECT * FROM sbt_mint_events WHERE transaction_hash = ${txHash}
  `
  return result.length > 0 ? (result[0] as SbtMintEvent) : null
}

// Close database connection (no-op for Neon serverless, but kept for compatibility)
export function closeDatabase(): void {
  // Neon serverless doesn't require explicit connection closing
  console.log('Neon serverless - no connection cleanup required')
}
