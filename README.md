# Monthly Mint - Discord Gated NFT Minting

A Next.js web application that enables Discord-gated NFT minting on the Botanix network. Users must verify their Discord membership and roles before connecting their wallet to mint Soulbound Tokens (SBTs) with IPFS-stored media.

**✨ Optimized for Vercel serverless deployment with Vercel KV (Redis) storage.**

> **⚠️ IMPORTANT:** This application **requires** Vercel KV (Redis) for data storage. You must create a Vercel KV database and configure the environment variables before running the application. See [Quick Start](#quick-start-local-development) for setup instructions.

## Features

- **Discord OAuth2 Authentication** - Popup-based Discord login
- **Guild Membership Verification** - Only members of the specified server can mint
- **Role-Based Access** - Discord roles determine minting eligibility
- **Wallet Connection** - RainbowKit integration for seamless wallet connect
- **Botanix Network** - Native support for Botanix blockchain
- **Soulbound Token (SBT) Minting** - Non-transferable NFTs with metadata
- **IPFS Media Upload** - Decentralized storage for NFT images
- **Signature-Based Minting** - Backend-signed transactions for security
- **Serverless Architecture** - Runs on Vercel with Vercel KV for data persistence

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+ installed
- A Vercel account (free tier works fine)
- **REQUIRED:** Vercel KV database (see setup instructions below)

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

3. **Set up Vercel KV (REQUIRED)**
   
   The application requires Vercel KV for data storage. You have two options:

   **Option A: Use Vercel CLI (Recommended)**
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Link to your Vercel project (create one if needed at vercel.com)
   vercel link
   
   # Create a KV database in your Vercel project:
   # - Go to https://vercel.com/dashboard
   # - Select your project → Storage tab
   # - Click "Create Database" → Select "KV"
   
   # Pull environment variables (includes KV credentials)
   vercel env pull .env.local
   ```

   **Option B: Manual Setup**
   ```bash
   # 1. Copy the example environment file
   cp .env.example .env.local
   
   # 2. Get KV credentials from Vercel:
   #    - Go to https://vercel.com/dashboard
   #    - Select your project → Storage → Your KV database
   #    - Click ".env.local" tab
   #    - Copy KV_REST_API_URL and KV_REST_API_TOKEN values
   
   # 3. Edit .env.local and paste the KV credentials
   # 4. Fill in other required environment variables (Discord, WalletConnect, etc.)
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

This application is optimized for deployment on Vercel's serverless infrastructure.

### Prerequisites

1. A [Vercel account](https://vercel.com/signup)
2. A Discord application (create at [Discord Developer Portal](https://discord.com/developers/applications))
3. A WalletConnect project ID (get at [WalletConnect Cloud](https://cloud.walletconnect.com/))

### Deployment Steps

1. **Push your code to GitHub** (or GitLab/Bitbucket)

2. **Import to Vercel:**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import your repository
   - Vercel will auto-detect Next.js

3. **Create a Vercel KV Database:**
   - In your Vercel project dashboard, go to the "Storage" tab
   - Click "Create Database"
   - Select "KV" (Redis-compatible key-value store)
   - Choose a name for your database
   - Click "Create"
   - Vercel will automatically set `KV_REST_API_URL` and `KV_REST_API_TOKEN` environment variables

4. **Configure Environment Variables:**
   - In your Vercel project settings, go to "Settings" → "Environment Variables"
   - Add all required environment variables from `.env.example`:
     ```
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
   - Note: KV_REST_API_URL and KV_REST_API_TOKEN are automatically set when you link the KV database

5. **Update Discord OAuth Redirect URI:**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Select your application
   - Go to OAuth2 → General
   - Add your Vercel deployment URL callback: `https://your-app.vercel.app/api/auth/discord/callback`

6. **Deploy:**
   - Click "Deploy" in Vercel
   - Vercel will build and deploy your application
   - Your app will be available at `https://your-app.vercel.app`

### Local Development with Vercel KV

To test with Vercel KV locally:

1. Install Vercel CLI: `npm i -g vercel`
2. Link your project: `vercel link`
3. Pull environment variables: `vercel env pull .env.local`
4. Run development server: `npm run dev`

The `.env.local` file will now contain your KV credentials for local testing.

## Environment Variables

All environment variables must be configured in `.env.local` (copy from `.env.example`):

### Vercel KV Configuration (REQUIRED)
```env
# These are REQUIRED for the application to work
# Automatically set by Vercel when you create and link a KV database
# For local development, get these from your Vercel project:
#   1. Go to https://vercel.com/dashboard
#   2. Select your project → Storage tab
#   3. Create a KV database if you haven't already
#   4. Click on your KV database → .env.local tab
#   5. Copy the values below
KV_REST_API_URL=your_kv_rest_api_url_here
KV_REST_API_TOKEN=your_kv_rest_api_token_here
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
- **Role-Based System** - Each role (Botanist, Hyperion Ambassador, Sequoia Ambassador, Blossom Ambassador, Seedling Ambassador, Sprout) has its own contract and predefined media
- **Predefined Media** - Each contract has its own IPFS URI for NFT images

### Components
- **SBTMinter Component** - React component that selects the appropriate contract based on user's Discord role
- **API Routes**:
  - `/api/nft/generate-mint-signature` - Generates backend signature for minting
- **Smart Contract** - Solidity contract in `/NFT/contract_gas.sol` (deploy 6 instances)

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

**Note:** Configure the predefined IPFS URIs for each role in `components/SBTMinter.tsx` in the `ROLE_CONTRACTS` constant.

### Usage Flow

1. User verifies Discord membership and role is detected
2. User connects wallet to Botanix network
3. System selects the appropriate contract and media based on user's Discord role
4. User fills in token metadata (credential type, issuer, expiry, level)
5. User gets signature from backend
6. User mints SBT from their role-specific contract

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

### Database: Vercel KV (Redis)

This application uses **Vercel KV** for data persistence instead of SQLite:

- **Serverless-compatible**: Works perfectly with Vercel's edge functions
- **Fast**: Redis-based storage with sub-50ms queries
- **Scalable**: Handles concurrent requests efficiently
- **Managed**: No database maintenance required

**Data stored in KV:**
- User profiles (Discord ID, username, metadata)
- Discord authentication logs
- Wallet connection records
- NFT mint events and history

### File Uploads

File uploads are handled in-memory for serverless compatibility:
- Images are limited to 5MB
- Files are validated before IPFS upload
- No local filesystem dependencies

## Differences from SQLite Version

If you're familiar with the SQLite version:

1. **Database layer is async**: All database functions return Promises
2. **No init-db script needed**: Database is created automatically
3. **Different data structure**: Redis uses key-value pairs instead of SQL tables
4. **No filesystem storage**: Everything is in Vercel KV or IPFS

The API interface remains the same - only the storage backend has changed.

## Troubleshooting

### Error: "Missing required environment variables KV_REST_API_URL and KV_REST_API_TOKEN"

This error occurs when trying to use the application without Vercel KV configured. To fix:

**For Local Development:**
1. Create a Vercel account at [vercel.com](https://vercel.com/signup)
2. Create a new project or link to an existing one
3. Go to your project → Storage tab
4. Click "Create Database" → Select "KV"
5. Get the credentials using one of these methods:

   **Option A: Vercel CLI (Easiest)**
   ```bash
   npm i -g vercel
   vercel link
   vercel env pull .env.local
   ```

   **Option B: Manual**
   - Go to Storage → Your KV database → .env.local tab
   - Copy `KV_REST_API_URL` and `KV_REST_API_TOKEN`
   - Add them to your `.env.local` file

**For Vercel Deployment:**
1. Go to your Vercel project dashboard
2. Navigate to Storage tab
3. Click "Create Database" → Select "KV"
4. The environment variables will be set automatically
5. Redeploy your application

### Discord Authentication Fails

- Verify `DISCORD_REDIRECT_URI` matches your deployment URL
- Check Discord app redirect URL is configured correctly at [Discord Developer Portal](https://discord.com/developers/applications)
- Ensure `DISCORD_CLIENT_SECRET` is set correctly

### Wallet Connection Issues

- Verify `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set
- Check `NEXT_PUBLIC_NETWORK_ID` is correct (3636 for testnet, 3637 for mainnet)
- Ensure contract addresses are valid
