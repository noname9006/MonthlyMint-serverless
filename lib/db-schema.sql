-- Neon Postgres Schema for Monthly Mint Application
-- This schema supports Discord accounts connected to wallet addresses and minted NFTs

-- Users table - stores Discord user information
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  discord_id TEXT UNIQUE NOT NULL,
  discord_username TEXT,
  discord_global_name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Discord authentication logs
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
);

-- Wallet connection logs
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
);

-- Discord to wallet address connections
CREATE TABLE IF NOT EXISTS discord_wallet_connections (
  id SERIAL PRIMARY KEY,
  discord_id TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  evm_address TEXT NOT NULL,
  connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  disconnected_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE (discord_id, evm_address)
);

-- NFT mint events
CREATE TABLE IF NOT EXISTS nft_mint_events (
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
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);
CREATE INDEX IF NOT EXISTS idx_discord_auth_logs_discord_id ON discord_auth_logs(discord_id);
CREATE INDEX IF NOT EXISTS idx_wallet_connect_logs_discord_id ON wallet_connect_logs(discord_id);
CREATE INDEX IF NOT EXISTS idx_discord_wallet_connections_discord_id ON discord_wallet_connections(discord_id);
CREATE INDEX IF NOT EXISTS idx_discord_wallet_connections_active ON discord_wallet_connections(discord_id, is_active);
CREATE INDEX IF NOT EXISTS idx_nft_mint_events_discord_id ON nft_mint_events(discord_id);
CREATE INDEX IF NOT EXISTS idx_nft_mint_events_tx_hash ON nft_mint_events(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_nft_mint_events_wallet ON nft_mint_events(wallet_address);
CREATE INDEX IF NOT EXISTS idx_nft_mint_events_contract ON nft_mint_events(contract_address);
