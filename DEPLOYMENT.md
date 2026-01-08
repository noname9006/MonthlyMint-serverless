# Deploying to Vercel

This guide explains how to deploy the Monthly Mint application to Vercel's serverless infrastructure.

## Overview

The application has been optimized for Vercel deployment with the following changes:
- **Serverless-compatible database**: Uses Vercel KV (Redis) instead of SQLite
- **Optimized file handling**: File uploads use memory-based parsing
- **No filesystem dependencies**: All data is stored in Vercel KV
- **Auto-scaling**: Serverless functions scale automatically

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com/signup)
2. **GitHub Account**: Your code should be in a GitHub repository
3. **Discord Application**: 
   - Create at [Discord Developer Portal](https://discord.com/developers/applications)
   - Note your Client ID and Client Secret
4. **WalletConnect Project**: 
   - Get a project ID at [WalletConnect Cloud](https://cloud.walletconnect.com/)
5. **Smart Contracts**: Deploy 6 SBT contracts (one per role) on Botanix network
6. **Backend Wallet**: A private key for signing mint approvals

## Step-by-Step Deployment

### 1. Prepare Your Repository

Ensure your latest code is pushed to GitHub:

```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

### 2. Create Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Click **"Import Git Repository"**
4. Select your GitHub repository
5. Vercel will auto-detect Next.js - click **"Continue"**

### 3. Create Vercel KV Database

**IMPORTANT**: Do this BEFORE configuring environment variables!

1. In your new Vercel project, go to the **"Storage"** tab
2. Click **"Create Database"**
3. Select **"KV"** (Redis-compatible key-value store)
4. Choose a name (e.g., `monthly-mint-kv`)
5. Select the same region as your project for best performance
6. Click **"Create"**

Vercel will automatically set these environment variables:
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_URL`

### 4. Configure Environment Variables

In your Vercel project settings, go to **"Settings" → "Environment Variables"**

Add the following variables for **Production**, **Preview**, and **Development**:

#### Discord Configuration
```
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=https://your-app.vercel.app/api/auth/discord/callback
NEXT_PUBLIC_DISCORD_CLIENT_ID=your_discord_client_id
```

⚠️ **Important**: Replace `your-app.vercel.app` with your actual Vercel deployment URL!

#### Blockchain Configuration
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
NEXT_PUBLIC_NETWORK_ID=3637
```

Network IDs:
- `3637` = Botanix Mainnet (production)
- `3636` = Botanix Testnet (testing)

#### NFT Contract Addresses
```
NEXT_PUBLIC_BOTANIST_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_HYPERION_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_SEQUOIA_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_BLOSSOM_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_SEEDLING_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_SPROUT_CONTRACT_ADDRESS=0x...
```

Replace with your actual deployed contract addresses.

#### Backend Configuration
```
BACKEND_PRIVATE_KEY=0x...
```

⚠️ **Security**: Keep this private key secure! Never commit it to source control.

#### Optional: IPFS Configuration
```
NEXT_PUBLIC_IPFS_GATEWAY=https://ipfs.io/ipfs
IPFS_API_URL=https://ipfs.infura.io:5001
```

### 5. Update Discord OAuth Settings

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Go to **OAuth2 → General**
4. In **Redirects**, add:
   ```
   https://your-app.vercel.app/api/auth/discord/callback
   ```
5. Click **"Save Changes"**

### 6. Deploy

1. Click **"Deploy"** in Vercel
2. Wait for the build to complete (~2-3 minutes)
3. Your app will be available at `https://your-app.vercel.app`

## Post-Deployment

### Verify Deployment

1. **Check Build Logs**: Ensure no errors in the Vercel deployment logs
2. **Test Discord Auth**: Visit your app and try Discord login
3. **Test Wallet Connect**: Connect a wallet and verify it works
4. **Monitor KV Usage**: Check the Storage tab for database activity

### Custom Domain (Optional)

1. In Vercel project settings, go to **"Domains"**
2. Add your custom domain
3. Update `DISCORD_REDIRECT_URI` environment variable
4. Update Discord OAuth redirect URL

## Local Development with Vercel KV

To test with production Vercel KV locally:

### Option 1: Use Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Link to your Vercel project
vercel link

# Pull environment variables (includes KV credentials)
vercel env pull .env.local

# Start dev server
npm run dev
```

### Option 2: Manual Configuration

1. Go to your Vercel project → Storage → Your KV database
2. Click on **".env.local"** tab
3. Copy the `KV_REST_API_URL` and `KV_REST_API_TOKEN` values
4. Add them to your local `.env.local` file:
   ```
   KV_REST_API_URL=https://...
   KV_REST_API_TOKEN=...
   ```

## Troubleshooting

### Build Fails

**Check these common issues:**

1. **Missing environment variables**: Ensure all required vars are set
2. **TypeScript errors**: Run `npm run build` locally first
3. **Dependency issues**: Make sure `package.json` is up to date
4. **Next.js telemetry warning**: The telemetry notice is disabled by default in `vercel.json`. If you see it, ensure `NEXT_TELEMETRY_DISABLED=1` is set in build environment.

### Runtime Errors

**Database connection issues:**
- Verify KV database is linked to your project
- Check that `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set
- Ensure the KV database is in the same region as your project

**Discord OAuth fails:**
- Verify `DISCORD_REDIRECT_URI` matches your Vercel URL
- Check Discord app redirect URL is configured correctly
- Ensure `DISCORD_CLIENT_SECRET` is set correctly
- If seeing "Discord authentication was cancelled" errors even when completing auth, ensure you're using the latest version with the popup timing fixes

**Wallet connection fails:**
- Verify `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set
- Check `NEXT_PUBLIC_NETWORK_ID` is correct (3636 or 3637)
- Ensure contract addresses are valid

### Performance Issues

**Cold starts:**
- Serverless functions may take 1-2 seconds to start if not recently used
- This is normal for serverless architectures
- Consider upgrading to Vercel Pro for faster performance

**Database queries:**
- Vercel KV is Redis-based and very fast
- Most queries complete in <50ms
- If performance is critical, consider Redis connection pooling

## Monitoring

### Vercel Analytics

Enable in project settings → Analytics to track:
- Page views
- Performance metrics
- Error rates

### Vercel Logs

View real-time logs:
1. Go to your project → Deployments
2. Click on a deployment
3. View **Functions** tab for API route logs

### KV Storage Monitoring

Monitor database usage:
1. Go to Storage tab
2. Select your KV database
3. View metrics:
   - Total keys
   - Memory usage
   - Request rate

## Scaling Considerations

### Free Tier Limits

Vercel Free tier includes:
- 100GB bandwidth/month
- Serverless function executions: 100GB-hours
- KV: 256 MB storage, 100K reads/day, 100K writes/day

### When to Upgrade

Consider Vercel Pro if you need:
- More bandwidth (1TB/month)
- Faster function performance
- Priority support
- Higher KV limits (512 MB, 10M reads/day)

## Migration from SQLite

If you're migrating from a SQLite-based deployment:

1. **Data is NOT automatically migrated** - Vercel KV starts empty
2. **Users will need to re-authenticate** via Discord
3. **Mint history will be empty** - previous mints won't be tracked
4. **Consider exporting SQLite data** if you need historical records

To export SQLite data before migration:
```bash
# Connect to your old deployment
sqlite3 data/app.db

# Export users
.mode csv
.output users.csv
SELECT * FROM users;

# Export mints
.output sbt_mint_events.csv
SELECT * FROM sbt_mint_events;
```

## Security Best Practices

1. **Never commit secrets**: Keep `.env.local` in `.gitignore`
2. **Rotate keys regularly**: Update `BACKEND_PRIVATE_KEY` periodically
3. **Use Vercel Secrets**: For sensitive environment variables
4. **Enable HTTPS only**: Vercel provides free SSL automatically
5. **Monitor logs**: Check for suspicious activity

## Support

- **Vercel Docs**: [nextjs.org/docs/deployment](https://nextjs.org/docs/deployment)
- **Vercel KV Docs**: [vercel.com/docs/storage/vercel-kv](https://vercel.com/docs/storage/vercel-kv)
- **Discord Developer**: [discord.com/developers/docs](https://discord.com/developers/docs)

## Next Steps

After successful deployment:

1. ✅ Test all functionality thoroughly
2. ✅ Set up custom domain (optional)
3. ✅ Enable Vercel Analytics
4. ✅ Configure alerts for errors
5. ✅ Document your deployment for your team
6. ✅ Share your app URL with users!

---

**Congratulations!** Your Monthly Mint app is now running on Vercel's serverless infrastructure. 🎉
