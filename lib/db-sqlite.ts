import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'app.db')

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// Initialize database connection
let db: Database.Database | null = null
let isInitialized = false

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    
    // Auto-initialize tables on first connection
    if (!isInitialized) {
      ensureTablesExist(db)
      isInitialized = true
    }
  }
  return db
}

// Ensure all tables exist (called automatically on first getDb())
function ensureTablesExist(database: Database.Database): void {
  // Create users table
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT UNIQUE NOT NULL,
      discord_username TEXT,
      discord_global_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Create discord_auth_logs table
  database.exec(`
    CREATE TABLE IF NOT EXISTS discord_auth_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL,
      user_id INTEGER,
      action TEXT NOT NULL,
      success INTEGER NOT NULL,
      error_message TEXT,
      ip_address TEXT,
      user_agent TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  // Create wallet_connect_logs table
  database.exec(`
    CREATE TABLE IF NOT EXISTS wallet_connect_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT,
      user_id INTEGER,
      wallet_address TEXT,
      action TEXT NOT NULL,
      success INTEGER NOT NULL,
      error_message TEXT,
      ip_address TEXT,
      user_agent TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  // Create discord_wallet_connections table
  database.exec(`
    CREATE TABLE IF NOT EXISTS discord_wallet_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      evm_address TEXT NOT NULL,
      connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      disconnected_at DATETIME,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE (discord_id, evm_address)
    )
  `)

  // Create NFT mint events table
  database.exec(`
    CREATE TABLE IF NOT EXISTS nft_mint_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      wallet_address TEXT NOT NULL,
      contract_address TEXT NOT NULL,
      token_id TEXT,
      transaction_hash TEXT NOT NULL,
      role_name TEXT,
      credential_type TEXT,
      metadata TEXT,
      media_uri TEXT,
      level INTEGER,
      level_name TEXT,
      month_name TEXT,
      year INTEGER,
      request_id TEXT UNIQUE, -- Nullable for backward compatibility with old single mints
      minted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  // Indexes for performance
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_nft_discord_id 
    ON nft_mint_events(discord_id)
  `)

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_nft_tx_hash 
    ON nft_mint_events(transaction_hash)
  `)

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_nft_wallet 
    ON nft_mint_events(wallet_address)
  `)
}

// Initialize database tables (can be called manually or automatically)
export function initDatabase(): void {
  const database = getDb()
  ensureTablesExist(database)
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

export function getUserByDiscordId(discordId: string): User | null {
  const database = getDb()
  const stmt = database.prepare('SELECT * FROM users WHERE discord_id = ?')
  return (stmt.get(discordId) as User) || null
}

export function createUser(discordId: string, username?: string, globalName?: string): User {
  const database = getDb()
  const stmt = database.prepare(`
    INSERT INTO users (discord_id, discord_username, discord_global_name)
    VALUES (?, ?, ?)
  `)
  const info = stmt.run(discordId, username || null, globalName || null)
  return getUserByDiscordId(discordId)!
}

export function updateUser(discordId: string, username?: string, globalName?: string): void {
  const database = getDb()
  const stmt = database.prepare(`
    UPDATE users
    SET discord_username = ?, discord_global_name = ?, updated_at = CURRENT_TIMESTAMP
    WHERE discord_id = ?
  `)
  stmt.run(username || null, globalName || null, discordId)
}

export function getOrCreateUser(discordId: string, username?: string, globalName?: string): User {
  let user = getUserByDiscordId(discordId)
  
  if (!user) {
    // Create new user
    user = createUser(discordId, username, globalName)
  } else {
    // Update user info if changed
    const needsUpdate = 
      (username && user.discord_username !== username) ||
      (globalName && user.discord_global_name !== globalName)
    
    if (needsUpdate) {
      updateUser(discordId, username, globalName)
      user = getUserByDiscordId(discordId)!
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

export function logDiscordAuth(log: DiscordAuthLog): void {
  const database = getDb()
  const stmt = database.prepare(`
    INSERT INTO discord_auth_logs (discord_id, user_id, action, success, error_message, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    log.discord_id,
    log.user_id || null,
    log.action,
    log.success ? 1 : 0,
    log.error_message || null,
    log.ip_address || null,
    log.user_agent || null
  )
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

export function logWalletConnect(log: WalletConnectLog): void {
  const database = getDb()
  const stmt = database.prepare(`
    INSERT INTO wallet_connect_logs (discord_id, user_id, wallet_address, action, success, error_message, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    log.discord_id || null,
    log.user_id || null,
    log.wallet_address ? log.wallet_address.toLowerCase() : null,
    log.action,
    log.success ? 1 : 0,
    log.error_message || null,
    log.ip_address || null,
    log.user_agent || null
  )
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

export function createDiscordWalletConnection(discordId: string, userId: number, evmAddress: string): void {
  const database = getDb()
  const normalizedAddress = evmAddress.toLowerCase()
  
  // Check if a connection already exists (active or inactive)
  const existingStmt = database.prepare(`
    SELECT id FROM discord_wallet_connections
    WHERE discord_id = ? AND evm_address = ?
  `)
  const existing = existingStmt.get(discordId, normalizedAddress) as { id: number } | undefined
  
  if (existing) {
    // Update existing connection to make it active
    const updateStmt = database.prepare(`
      UPDATE discord_wallet_connections
      SET is_active = 1, user_id = ?, connected_at = CURRENT_TIMESTAMP, disconnected_at = NULL
      WHERE discord_id = ? AND evm_address = ?
    `)
    updateStmt.run(userId, discordId, normalizedAddress)
  } else {
    // Create new connection
    const insertStmt = database.prepare(`
      INSERT INTO discord_wallet_connections (discord_id, user_id, evm_address)
      VALUES (?, ?, ?)
    `)
    insertStmt.run(discordId, userId, normalizedAddress)
  }
}

export function deactivateDiscordWalletConnection(discordId: string, evmAddress: string): void {
  const database = getDb()
  const stmt = database.prepare(`
    UPDATE discord_wallet_connections
    SET is_active = 0, disconnected_at = CURRENT_TIMESTAMP
    WHERE discord_id = ? AND evm_address = ? AND is_active = 1
  `)
  stmt.run(discordId, evmAddress.toLowerCase())
}

export function getActiveWalletConnections(discordId: string): DiscordWalletConnection[] {
  const database = getDb()
  const stmt = database.prepare(`
    SELECT * FROM discord_wallet_connections
    WHERE discord_id = ? AND is_active = 1
  `)
  return stmt.all(discordId) as DiscordWalletConnection[]
}

export function getActiveWalletConnectionByAddress(discordId: string, evmAddress: string): DiscordWalletConnection | null {
  const database = getDb()
  const stmt = database.prepare(`
    SELECT * FROM discord_wallet_connections
    WHERE discord_id = ? AND evm_address = ? AND is_active = 1
  `)
  return (stmt.get(discordId, evmAddress.toLowerCase()) as DiscordWalletConnection) || null
}

// NFT Mint Event Tracking

export interface NftMintEvent {
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
  level_name?: string
  month_name?: string
  year?: number
  request_id?: string
  minted_at?: string
}

// Log a new mint event
type LogNftMintResult = 
  | { success: true; alreadyLogged: boolean }
  | { success: false; error: string }

export function logNftMint(event: NftMintEvent): LogNftMintResult {
  const database = getDb()
  
  try {
    // Check if transaction already logged (idempotency)
    const existingStmt = database.prepare(`
      SELECT id FROM nft_mint_events WHERE transaction_hash = ?
    `)
    const existing = existingStmt.get(event.transaction_hash)
    
    if (existing) {
      console.log(`Mint already logged for tx: ${event.transaction_hash}`)
      return { success: true, alreadyLogged: true }
    }
    
    const stmt = database.prepare(`
      INSERT INTO nft_mint_events 
      (discord_id, user_id, wallet_address, contract_address, token_id, 
       transaction_hash, role_name, credential_type, metadata, media_uri, level,
       level_name, month_name, year, request_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    const info = stmt.run(
      event.discord_id,
      event.user_id,
      event.wallet_address.toLowerCase(),
      event.contract_address.toLowerCase(),
      event.token_id || null,
      event.transaction_hash,
      event.role_name || null,
      event.credential_type || null,
      event.metadata || null,
      event.media_uri || null,
      event.level || null,
      event.level_name || null,
      event.month_name || null,
      event.year || null,
      event.request_id || null
    )
    
    // Verify the insert was successful
    if (info.changes === 0) {
      return { success: false, error: 'Database insert failed - no rows affected' }
    }
    
    return { success: true, alreadyLogged: false }
  } catch (error) {
    console.error('Error in logNftMint:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown database error'
    }
  }
}

// Get total mints for a Discord user
export function getUserMintCount(discordId: string): number {
  const database = getDb()
  const stmt = database.prepare(`
    SELECT COUNT(*) as count FROM nft_mint_events WHERE discord_id = ?
  `)
  const result = stmt.get(discordId) as { count: number }
  return result.count
}

// Get all mints for a Discord user
export function getUserMints(discordId: string): NftMintEvent[] {
  const database = getDb()
  const stmt = database.prepare(`
    SELECT * FROM nft_mint_events 
    WHERE discord_id = ? 
    ORDER BY minted_at DESC
  `)
  return stmt.all(discordId) as NftMintEvent[]
}

// Check if user already minted for specific role
export function hasUserMintedForRole(discordId: string, roleName: string): boolean {
  const database = getDb()
  const stmt = database.prepare(`
    SELECT COUNT(*) as count FROM nft_mint_events 
    WHERE discord_id = ? AND role_name = ?
  `)
  const result = stmt.get(discordId, roleName) as { count: number }
  return result.count > 0
}

// Check if user already minted for specific contract
export function hasUserMintedForContract(discordId: string, contractAddress: string): boolean {
  const database = getDb()
  const stmt = database.prepare(`
    SELECT COUNT(*) as count FROM nft_mint_events 
    WHERE discord_id = ? AND contract_address = ?
  `)
  const result = stmt.get(discordId, contractAddress.toLowerCase()) as { count: number }
  return result.count > 0
}

// Check if user already minted for specific tier (levelName + year + monthName)
export function hasUserMintedForTier(
  discordId: string, 
  levelName: string, 
  year: number, 
  monthName: string
): boolean {
  const database = getDb()
  const stmt = database.prepare(`
    SELECT COUNT(*) as count FROM nft_mint_events 
    WHERE discord_id = ? 
      AND level_name = ?
      AND year = ?
      AND month_name = ?
  `)
  const result = stmt.get(discordId, levelName, year, monthName) as { count: number }
  return result.count > 0
}

// Get mint by transaction hash
export function getMintByTxHash(txHash: string): NftMintEvent | null {
  const database = getDb()
  const stmt = database.prepare(`
    SELECT * FROM nft_mint_events WHERE transaction_hash = ?
  `)
  return (stmt.get(txHash) as NftMintEvent) || null
}

// Get mint by request ID (for batch mints)
export function getMintByRequestId(requestId: string): NftMintEvent | null {
  const database = getDb()
  const stmt = database.prepare(`
    SELECT * FROM nft_mint_events WHERE request_id = ?
  `)
  return (stmt.get(requestId) as NftMintEvent) || null
}

// Close database connection (useful for testing)
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
