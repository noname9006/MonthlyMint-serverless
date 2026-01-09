# Monthly Mint - Discord Gated NFT Minting

A Next.js web application that enables Discord-gated NFT minting on the Botanix network. Users must verify their Discord membership and roles before connecting their wallet to mint Soulbound Tokens (SBTs) with IPFS-stored media.

**✨ Optimized for Vercel serverless deployment with Neon Postgres database.**

> **⚠️ IMPORTANT:** This application **requires** a Neon Postgres database for data storage. You must create a Neon database and configure the DATABASE_URL environment variable before running the application. See [Quick Start](#quick-start-local-development) for setup instructions.

## Features

- **Discord OAuth2 Authentication** - Popup-based Discord login
- **Guild Membership Verification** - Only members of the specified server can mint
- **Role-Based Access** - Discord roles determine minting eligibility
- **Wallet Connection** - RainbowKit integration for seamless wallet connect
- **Botanix Network** - Native support for Botanix blockchain
- **Soulbound Token (SBT) Minting** - Non-transferable NFTs with metadata
- **IPFS Media Upload** - Decentralized storage for NFT images
- **Signature-Based Minting** - Backend-signed transactions for security
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
     NEXT_PUBLIC_BOTANIST_CONTRACT_ADDRESS
     NEXT_PUBLIC_HYPERION_CONTRACT_ADDRESS
     NEXT_PUBLIC_SEQUOIA_CONTRACT_ADDRESS
     NEXT_PUBLIC_BLOSSOM_CONTRACT_ADDRESS
     NEXT_PUBLIC_SEEDLING_CONTRACT_ADDRESS
     NEXT_PUBLIC_SPROUT_CONTRACT_ADDRESS
     BACKEND_PRIVATE_KEY
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

### NFT Contract Addresses (One per Discord Role)
```env
# Botanist role contract (highest tier)
NEXT_PUBLIC_BOTANIST_CONTRACT_ADDRESS=your_botanist_contract_address_here

# Hyperion Ambassador role contract
NEXT_PUBLIC_HYPERION_CONTRACT_ADDRESS=your_hyperion_contract_address_here

# Sequoia Ambassador role contract
NEXT_PUBLIC_SEQUOIA_CONTRACT_ADDRESS=your_sequoia_contract_address_here

# Blossom Ambassador role contract
NEXT_PUBLIC_BLOSSOM_CONTRACT_ADDRESS=your_blossom_contract_address_here

# Seedling Ambassador role contract
NEXT_PUBLIC_SEEDLING_CONTRACT_ADDRESS=your_seedling_contract_address_here

# Sprout role contract (entry tier)
NEXT_PUBLIC_SPROUT_CONTRACT_ADDRESS=your_sprout_contract_address_here
```

### Backend Configuration
```env
# Private key for signing mint approvals (keep secure, never expose!)
BACKEND_PRIVATE_KEY=your_backend_wallet_private_key_here
```

## NFT Integration

The application includes a complete SBT (Soulbound Token) minting system integrated from the `/NFT` folder:

### Architecture
- **6 Separate NFT Contracts** - One dedicated contract per Discord role
- **Role-Based System** - Each role (Botanist, Hyperion Ambassador, Sequoia Ambassador, Blossom Ambassador, Seedling Ambassador, Sprout) has its own contract
- **Dynamic Media URIs** - Each contract stores its own default media URI (IPFS URI for NFT images) which is fetched dynamically by the frontend

### Components
- **SBTMinter Component** - React component that selects the appropriate contract based on user's Discord role and fetches media URIs from the contract
- **API Routes**:
  - `/api/nft/generate-mint-signature` - Generates backend signature for minting
- **Smart Contract** - Solidity contract in `/NFT/SBTv5_fixed.sol` (deploy 6 instances, each with its own default media URI)

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

# NFT/SBT Configuration - One contract per Discord role
# Deploy 6 instances of the SBT contract (one for each role)
# Each contract should be deployed with its own defaultMediaURI parameter
# The frontend will fetch the media URI from each contract dynamically
# Contract address for Botanist role (highest tier)
NEXT_PUBLIC_BOTANIST_CONTRACT_ADDRESS=your_botanist_contract_address_here
# Contract address for Hyperion Ambassador role
NEXT_PUBLIC_HYPERION_CONTRACT_ADDRESS=your_hyperion_contract_address_here
# Contract address for Sequoia Ambassador role
NEXT_PUBLIC_SEQUOIA_CONTRACT_ADDRESS=your_sequoia_contract_address_here
# Contract address for Blossom Ambassador role
NEXT_PUBLIC_BLOSSOM_CONTRACT_ADDRESS=your_blossom_contract_address_here
# Contract address for Seedling Ambassador role
NEXT_PUBLIC_SEEDLING_CONTRACT_ADDRESS=your_seedling_contract_address_here
# Contract address for Sprout role (entry tier)
NEXT_PUBLIC_SPROUT_CONTRACT_ADDRESS=your_sprout_contract_address_here

# Backend Private Key
# Private key of the wallet used to sign mint approvals (keep this secure!)
BACKEND_PRIVATE_KEY=your_backend_wallet_private_key_here
```

**Note:** When deploying each contract, pass the appropriate IPFS URI as the `_defaultMediaURI` parameter in the constructor. The frontend will automatically fetch and use these URIs from the contracts.

### Contract Deployment

When deploying the SBT contract for each role, use the following constructor parameters:
```solidity
constructor(
  address _signerAddress,    // Backend wallet address that signs mint approvals
  string memory _baseURI,     // Base URI for metadata (e.g., "https://your-api.com/metadata/")
  string memory _defaultMediaURI  // IPFS URI for the role's NFT image (e.g., "ipfs://QmYourImageHash")
)
```

Example deployment for Botanist role:
```javascript
// Deploy contract with media URI
const contract = await deploy("ComplexSoulboundToken", [
  backendWalletAddress,
  "https://your-api.com/metadata/",
  "ipfs://bafkreifidlnietci72bpenigi2sgbmuisfm6zslmofcmpdig7r5pum5qn4"  // Botanist NFT image
])
```

Repeat for each role with their respective media URIs.

### Usage Flow

1. User verifies Discord membership and role is detected
2. User connects wallet to Botanix network
3. System selects the appropriate contract based on user's Discord role
4. System fetches the media URI from the selected contract
5. User fills in token metadata (credential type, issuer, expiry, level)
6. User gets signature from backend
7. User mints SBT from their role-specific contract with the fetched media URI

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
- `sbt_mint_events` - Records all NFT mints with Discord ID, wallet address, contract, and metadata
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
