# Monthly Mint - Discord Gated NFT Minting

A Next.js web application that enables Discord-gated NFT minting on the Botanix network. Users must verify their Discord membership and roles before connecting their wallet to mint NFTs (ERC721 Transferable Tokens) with customizable media links.

**✨ Optimized for Vercel serverless deployment with Neon Postgres database.**

> **⚠️ IMPORTANT:** This application **requires** a Neon Postgres database for data storage. You must create a Neon database and configure the DATABASE_URL environment variable before running the application. See [Quick Start](#quick-start-local-development) for setup instructions.

## Features

- **Discord OAuth2 Authentication** - Popup-based Discord login
- **Guild Membership Verification** - Only members of the specified server can mint
- **Role-Based Access** - Discord roles determine minting eligibility
- **Wallet Connection** - RainbowKit integration for seamless wallet connect
- **Botanix Network** - Native support for Botanix blockchain
- **NFT (ERC721 Transferable Token) Minting** - Transferable NFTs with metadata
- **Single Unified Contract** - One contract for all roles and levels
- **Environment-Based Media** - Media URIs configured via environment variables for each level/year/month
- **EIP-712 Signature Standard** - Secure backend-signed transactions using typed structured data
- **Batch Minting Support** - Mint multiple NFTs in a single transaction
- **Admin-Managed Minting** - Current month controlled via admin endpoint
- **Serverless Architecture** - Runs on Vercel with Neon Postgres for data persistence
- **Discord-Wallet Connections** - Link Discord accounts to wallet addresses and track minted NFTs

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+ installed
- A Neon account (free tier available)
- **REQUIRED:** Neon Postgres database (see setup instructions below)

### Setup Instructions

1. **Clone this repository**
   ```bash
   git clone <your-repo-url>
   cd MonthlyMint-serverless
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Neon Postgres Database (REQUIRED)**
   
   The application requires Neon Postgres for data storage.

   **📖 See the complete setup guide: [NEON_SETUP.md](NEON_SETUP.md)**

   **Quick steps:**
   ```bash
   # 1. Go to https://neon.tech and sign up (free tier available)
   
   # 2. Create a new project:
   #    - Click "Create a project"
   #    - Choose a name and region
   #    - Click "Create project"
   
   # 3. Copy the connection string:
   #    - Select "Pooled connection" from the dashboard
   #    - Copy the full connection string
   
   # 4. Add to your .env.local file:
   cp .env.example .env.local
   # Edit .env.local and paste the connection string as DATABASE_URL
   ```

4. **Configure environment variables in `.env.local`**
   - Set `NEXT_PUBLIC_NETWORK_ID` to `3636` for testnet or `3637` for mainnet
   - Add your Discord OAuth credentials
   - Add your WalletConnect Project ID
   - Add contract addresses and backend private key
   - See `.env.example` for all required variables

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Visit** `http://localhost:3000`

**Note:** If you change any `NEXT_PUBLIC_*` environment variables after starting the dev server, you must restart it for changes to take effect (stop with Ctrl+C and run `npm run dev` again).

## Vercel Deployment

This application is optimized for deployment on Vercel's serverless infrastructure with Neon Postgres.

### Prerequisites

1. A [Vercel account](https://vercel.com/signup)
2. A [Neon account](https://neon.tech) (free tier available)
3. A Discord application (create at [Discord Developer Portal](https://discord.com/developers/applications))
4. A WalletConnect project ID (get at [WalletConnect Cloud](https://cloud.walletconnect.com/))

### Deployment Steps

1. **Push your code to GitHub** (or GitLab/Bitbucket)

2. **Import to Vercel:**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import your repository
   - Vercel will auto-detect Next.js

3. **Create a Neon Postgres Database:**
   - Go to [Neon Console](https://console.neon.tech)
   - Click "Create a project"
   - Choose a project name and region (choose closest to your users)
   - Click "Create project"
   - Copy the connection string from the dashboard
   - The connection string will look like: `postgresql://[user]:[password]@[host]/[database]?sslmode=require`

4. **Configure Environment Variables:**
   - In your Vercel project settings, go to "Settings" → "Environment Variables"
   - Add all required environment variables from `.env.example`:
     ```
     DATABASE_URL (your Neon Postgres connection string)
     DISCORD_CLIENT_ID
     DISCORD_CLIENT_SECRET
     DISCORD_REDIRECT_URI (use your Vercel URL: https://your-app.vercel.app/api/auth/discord/callback)
     NEXT_PUBLIC_DISCORD_CLIENT_ID
     NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
     NEXT_PUBLIC_NETWORK_ID
     NEXT_PUBLIC_NFT_CONTRACT_ADDRESS (single unified contract)
     ADMIN_SECRET (for managing current month)
     BACKEND_PRIVATE_KEY
     Media URI environment variables (e.g., NEXT_PUBLIC_BOTANIST_2025_JAN)
     ```

5. **Update Discord OAuth Redirect URI:**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Select your application
   - Go to OAuth2 → General
   - Add your Vercel deployment URL callback: `https://your-app.vercel.app/api/auth/discord/callback`

6. **Deploy:**
   - Click "Deploy" in Vercel
   - Vercel will build and deploy your application
   - Your app will be available at `https://your-app.vercel.app`

### Local Development with Neon

To test with Neon locally:

1. Create a Neon project at [neon.tech](https://neon.tech)
2. Copy the connection string
3. Add to `.env.local`: `DATABASE_URL=your_connection_string`
4. Run development server: `npm run dev`

The database tables will be created automatically on first run.

## Environment Variables

All environment variables must be configured in `.env.local` (copy from `.env.example`):

### Neon Database Configuration (REQUIRED)
```env
# This is REQUIRED for the application to work
# Get this from your Neon project dashboard at https://neon.tech
# Connection string format: postgresql://[user]:[password]@[host]/[database]?sslmode=require
DATABASE_URL=your_neon_database_connection_string_here
```

### Discord OAuth2 Configuration
```env
# Discord application client ID
# Create at: https://discord.com/developers/applications
DISCORD_CLIENT_ID=your_discord_client_id_here

# Discord application client secret (server-side only, keep secure)
DISCORD_CLIENT_SECRET=your_discord_client_secret_here

# OAuth2 callback URL (must match Discord app settings)
DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback

# Public Discord client ID (safe for browser exposure)
NEXT_PUBLIC_DISCORD_CLIENT_ID=your_discord_client_id_here
```

### Wallet Configuration
```env
# WalletConnect project ID
# Get yours at: https://cloud.walletconnect.com/
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id_here
```

### Blockchain Network Configuration
The application supports both Botanix Mainnet and Testnet. Both network configurations are hardcoded, and you can easily switch between them by setting the network ID.

```env
# Network Selection
# Set NEXT_PUBLIC_NETWORK_ID to the chain ID of the network you want to use
# 3637 = Botanix Mainnet (default)
# 3636 = Botanix Testnet
NEXT_PUBLIC_NETWORK_ID=3637
```

**Network Details:**

| Network | Chain ID | RPC URL | Explorer |
|---------|----------|---------|----------|
| Mainnet (default) | 3637 | https://rpc.botanixlabs.com | https://botanixscan.io/ |
| Testnet | 3636 | https://node.botanixlabs.dev | https://testnet.botanixscan.io/ |

**To switch to Botanix Testnet:**
1. Set `NEXT_PUBLIC_NETWORK_ID=3636` in your `.env.local` file
2. **Important:** Restart the development server for changes to take effect:
   ```bash
   # Stop the current dev server (Ctrl+C) and restart:
   npm run dev
   ```
   Or for production builds:
   ```bash
   npm run build
   npm start
   ```

> **Note:** Environment variables prefixed with `NEXT_PUBLIC_` are embedded at build time in Next.js. Simply changing the `.env.local` file is not enough - you must restart the dev server or rebuild the application for the changes to be applied.

### NFT Contract Address (Single Unified Contract)
```env
# Single NFT contract address for all roles and levels
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=your_nft_contract_address_here
```

### NFT Media Configuration
Media URIs are configured via environment variables for each level/year/month combination:
```env
# Format: NEXT_PUBLIC_{LEVEL}_{YEAR}_{MONTH}
# Examples:
NEXT_PUBLIC_BOTANIST_2025_JAN=ipfs://your_botanist_january_2025_media_uri
NEXT_PUBLIC_BOTANIST_2025_FEB=ipfs://your_botanist_february_2025_media_uri
NEXT_PUBLIC_HYPERION_2025_JAN=ipfs://your_hyperion_january_2025_media_uri
NEXT_PUBLIC_SEQUOIA_2025_JAN=ipfs://your_sequoia_january_2025_media_uri
NEXT_PUBLIC_BLOSSOM_2025_JAN=ipfs://your_blossom_january_2025_media_uri
NEXT_PUBLIC_SEEDLING_2025_JAN=ipfs://your_seedling_january_2025_media_uri
NEXT_PUBLIC_SPROUT_2025_JAN=ipfs://your_sprout_january_2025_media_uri
# Add more as needed for different months and years
```

### Backend Configuration
```env
# Private key for signing mint approvals (keep secure, never expose!)
BACKEND_PRIVATE_KEY=your_backend_wallet_private_key_here

# Admin secret for managing current month (keep secure!)
ADMIN_SECRET=your_admin_secret_here
```

## NFT Integration

The application includes a complete NFT minting system using the BotanistTokenEIP712 contract:

### Architecture
- **Single Unified Contract** - One BotanistTokenEIP712 contract handles all roles and levels
- **Role-Based Access** - Discord roles (Botanist, Hyperion Ambassador, Sequoia Ambassador, Blossom Ambassador, Seedling Ambassador, Sprout) determine minting eligibility
- **Environment-Based Media** - Media URIs configured via environment variables for each level/year/month combination
- **EIP-712 Signatures** - Backend signs minting requests using typed structured data standard
- **Batch Minting** - Support for minting multiple NFTs in a single transaction
- **Admin-Controlled Minting** - Current month managed via secure admin endpoint

### Components
- **NFTMinter Component** - React component that handles NFT minting with EIP-712 signature verification
- **API Routes**:
  - `/api/nft/generate-mint-signature` - Generates EIP-712 signature for minting
  - `/api/admin/set-current-month` - Admin endpoint to update the current mintable month
- **Smart Contract** - BotanistTokenEIP712 contract in `/NFT/BotanistTokenEIP712.sol`

### Configuration

Copy `.env.example` to `.env.local` and configure the following environment variables:

```env
# Discord OAuth2 Configuration
# Create a Discord application at https://discord.com/developers/applications
DISCORD_CLIENT_ID=your_discord_client_id_here
# Discord application client secret (keep this secure, server-side only)
DISCORD_CLIENT_SECRET=your_discord_client_secret_here
# OAuth2 redirect URI - must match Discord app settings
DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback

# Public Discord Client ID (for frontend)
# Same as DISCORD_CLIENT_ID, but safe to expose to the browser
NEXT_PUBLIC_DISCORD_CLIENT_ID=your_discord_client_id_here

# WalletConnect Project ID
# Get your project ID at https://cloud.walletconnect.com/
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id_here

# NFT Configuration - Single Unified Contract
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=your_nft_contract_address_here

# Backend Private Key
# Private key of the wallet used to sign mint approvals (keep this secure!)
BACKEND_PRIVATE_KEY=your_backend_wallet_private_key_here

# Admin Secret
# Secret for managing current month (keep this secure!)
ADMIN_SECRET=your_admin_secret_here

# Media URIs for each level/year/month
# Format: NEXT_PUBLIC_{LEVEL}_{YEAR}_{MONTH}
NEXT_PUBLIC_BOTANIST_2025_JAN=ipfs://your_botanist_january_2025_media_uri
NEXT_PUBLIC_HYPERION_2025_JAN=ipfs://your_hyperion_january_2025_media_uri
NEXT_PUBLIC_SEQUOIA_2025_JAN=ipfs://your_sequoia_january_2025_media_uri
NEXT_PUBLIC_BLOSSOM_2025_JAN=ipfs://your_blossom_january_2025_media_uri
NEXT_PUBLIC_SEEDLING_2025_JAN=ipfs://your_seedling_january_2025_media_uri
NEXT_PUBLIC_SPROUT_2025_JAN=ipfs://your_sprout_january_2025_media_uri
# Add more for different months and years as needed
```

### Contract Deployment

The BotanistTokenEIP712 contract uses the following constructor:
```solidity
constructor(
  address _signerAddress,    // Backend wallet address that signs mint approvals
  string memory _baseURI     // Base URI for metadata (e.g., "https://your-api.com/metadata/")
)
```

Example deployment:
```javascript
// Deploy single unified contract
const contract = await deploy("BotanistTokenEIP712", [
  backendWalletAddress,
  "https://your-api.com/metadata/"
])
```

### Minting Parameters

The contract accepts the following parameters for minting:
- `to` - Recipient wallet address
- `levelName` - Discord role/level name (e.g., "Botanist", "Hyperion Ambassador")
- `monthName` - Month name (e.g., "January", "February")
- `year` - Year (e.g., 2025)
- `requestId` - Unique identifier to prevent replay attacks
- `mediaURI` - IPFS or HTTP URI for the NFT media (from environment variables)
- `signature` - EIP-712 signature from backend

### Batch Minting

The contract supports batch minting multiple NFTs in one transaction:
```javascript
// Mint multiple NFTs at once
await contract.batchMint(
  to,
  [levelName1, levelName2],
  [monthName1, monthName2],
  [year1, year2],
  [requestId1, requestId2],
  [mediaURI1, mediaURI2],
  signatures
)
```

### Admin Endpoint: Set Current Month

The admin endpoint allows authorized users to update the current mintable month:

**Endpoint:** `POST /api/admin/set-current-month`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_ADMIN_SECRET
```

**Body:**
```json
{
  "month": "February",
  "year": 2025
}
```

**Response:**
```json
{
  "success": true,
  "currentMonth": "February",
  "currentYear": 2025
}
```

This ensures users can only mint NFTs for the currently active month as configured by administrators.

### Usage Flow

1. User verifies Discord membership and role is detected
2. User connects wallet to Botanix network
3. Frontend determines the appropriate media URI from environment variables based on user's role, current year, and month
4. User initiates minting with level name, month name, year, and unique request ID
5. Backend generates EIP-712 signature with the provided parameters
6. User mints NFT from the unified contract with the signature
7. Contract validates signature, checks current month, and mints the NFT

## Production Deployment

### Deploying to Vercel

This application is optimized for deployment on Vercel's serverless platform. See the detailed deployment guide:

**📖 [Complete Deployment Guide →](DEPLOYMENT.md)**

Key features for Vercel deployment:
- ✅ **Serverless-ready**: All API routes are serverless functions
- ✅ **Vercel KV Integration**: Redis-based data storage (no SQLite)
- ✅ **Auto-scaling**: Handles traffic spikes automatically
- ✅ **Zero configuration**: Works out-of-the-box on Vercel
- ✅ **Global CDN**: Fast worldwide performance

Quick deployment steps:
1. Push your code to GitHub
2. Import to Vercel
3. Create a Vercel KV database
4. Configure environment variables
5. Deploy!

For detailed instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Architecture Notes

### Database: Neon Postgres

This application uses **Neon Postgres** for data persistence:

- **Serverless-compatible**: Works perfectly with Vercel's edge functions
- **Fast**: Serverless Postgres with auto-scaling and connection pooling
- **SQL-based**: Familiar SQL syntax, similar to SQLite but serverless
- **Managed**: No database maintenance required
- **Scalable**: Handles concurrent requests efficiently

**Data stored in Neon:**
- User profiles (Discord ID, username, metadata)
- Discord authentication logs
- Wallet connection records (Discord accounts linked to wallet addresses)
- NFT mint events and history (tracking which Discord users minted which NFTs)

**Schema highlights:**
- `users` - Discord user information
- `discord_wallet_connections` - Links Discord accounts to EVM wallet addresses
- `nft_mint_events` - Records all NFT mints with Discord ID, wallet address, contract, and metadata
- Full relational database with foreign keys and indexes for optimal performance

### File Uploads

File uploads are handled in-memory for serverless compatibility:
- Images are limited to 5MB
- Files are validated before IPFS upload
- No local filesystem dependencies

## Differences from Redis/KV Version

If you're familiar with the Vercel KV (Redis) version:

1. **Database uses SQL**: Standard SQL queries instead of Redis commands
2. **Relational structure**: Proper tables with foreign keys instead of key-value pairs
3. **Automatic schema creation**: Database tables are created automatically on first run
4. **Better for complex queries**: Easier to query relationships between Discord accounts, wallets, and NFTs
5. **PostgreSQL features**: Full support for transactions, constraints, and indexes

The API interface remains the same - only the storage backend has changed.

## Troubleshooting

### Error: "DATABASE_URL environment variable is not set"

This error occurs when trying to use the application without a Neon database configured. To fix:

**For Local Development:**
1. Create a Neon account at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string from the dashboard
4. Add it to your `.env.local` file:
   ```env
   DATABASE_URL=postgresql://[user]:[password]@[host]/[database]?sslmode=require
   ```

**For Vercel Deployment:**
1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add `DATABASE_URL` with your Neon connection string
4. Redeploy your application

### Discord Authentication Fails

- Verify `DISCORD_REDIRECT_URI` matches your deployment URL
- Check Discord app redirect URL is configured correctly at [Discord Developer Portal](https://discord.com/developers/applications)
- Ensure `DISCORD_CLIENT_SECRET` is set correctly

### Wallet Connection Issues

- Verify `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set
- Check `NEXT_PUBLIC_NETWORK_ID` is correct (3636 for testnet, 3637 for mainnet)
- Ensure contract addresses are valid
