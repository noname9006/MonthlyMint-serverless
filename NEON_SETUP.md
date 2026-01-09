# Neon Database Setup Guide

This guide will help you set up a Neon Postgres database for the Monthly Mint application.

## What is Neon?

Neon is a serverless Postgres database that's perfect for this application because:
- **Serverless**: No server management required
- **SQL-based**: Familiar SQL syntax similar to SQLite but in the cloud
- **Scalable**: Automatically scales with your application
- **Free tier**: Generous free tier for development and small projects
- **Fast**: Low latency with automatic connection pooling

## Step-by-Step Setup

### 1. Create a Neon Account

1. Go to [https://neon.tech](https://neon.tech)
2. Click "Sign Up" and create an account (you can use GitHub, Google, or email)
3. Verify your email if required

### 2. Create a New Project

1. After logging in, click "Create a project" or "New Project"
2. Choose a project name (e.g., "monthly-mint-db")
3. Select a region closest to your users or Vercel deployment:
   - US East (Ohio) - for US-based users
   - EU (Frankfurt) - for European users
   - Asia Pacific (Singapore) - for Asian users
4. Click "Create project"

### 3. Get Your Connection String

After creating the project, you'll see the dashboard with connection details:

1. Look for the "Connection string" section
2. Select the "Pooled connection" option (recommended for serverless)
3. Copy the connection string - it will look like:
   ```
   postgresql://[username]:[password]@[host]/[database]?sslmode=require
   ```

### 4. Configure Your Application

#### For Local Development:

1. Create a `.env.local` file in the project root (if you don't have one):
   ```bash
   cp .env.example .env.local
   ```

2. Add the connection string to `.env.local`:
   ```env
   DATABASE_URL=postgresql://[username]:[password]@[host]/[database]?sslmode=require
   ```

3. Add other required environment variables (Discord, WalletConnect, etc.)

#### For Vercel Deployment:

1. Go to your Vercel project settings
2. Navigate to "Settings" → "Environment Variables"
3. Add a new environment variable:
   - Name: `DATABASE_URL`
   - Value: Your Neon connection string
   - Environments: Check Production, Preview, and Development
4. Click "Save"

### 5. Database Schema

The application will automatically create all necessary tables on first run:
- `users` - Discord user information
- `discord_auth_logs` - Authentication logs
- `wallet_connect_logs` - Wallet connection logs
- `discord_wallet_connections` - Links Discord accounts to wallet addresses
- `sbt_mint_events` - NFT mint event tracking

You don't need to run any migrations or SQL scripts manually!

## Verification

To verify your database is set up correctly:

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Check the console for the message:
   ```
   Database schema initialized successfully
   ```

3. Try authenticating with Discord - if successful, the database is working!

## Managing Your Database

### Viewing Data

You can view and query your data using the Neon console:

1. Go to [https://console.neon.tech](https://console.neon.tech)
2. Select your project
3. Click on "SQL Editor" in the sidebar
4. Run queries to view your data:
   ```sql
   -- View all users
   SELECT * FROM users;
   
   -- View all mints for a specific Discord user
   SELECT * FROM sbt_mint_events WHERE discord_id = 'YOUR_DISCORD_ID';
   
   -- View all wallet connections
   SELECT * FROM discord_wallet_connections WHERE is_active = true;
   ```

### Backing Up Data

Neon automatically backs up your data. To create manual backups:

1. Go to your project in Neon console
2. Click on "Backups" in the sidebar
3. Click "Create backup"

### Monitoring

Monitor your database usage:

1. Go to your Neon project dashboard
2. View metrics for:
   - Database size
   - Connection count
   - Query performance
   - Storage usage

## Troubleshooting

### Error: "DATABASE_URL environment variable is not set"

**Solution**: Make sure you've added the DATABASE_URL to your `.env.local` file or Vercel environment variables.

### Error: "Connection failed" or "timeout"

**Solutions**:
1. Check that your connection string is correct
2. Verify the connection string includes `?sslmode=require` at the end
3. Make sure you're using the "Pooled connection" string for serverless
4. Check your Neon project is active (free tier databases may pause after inactivity)

### Tables not created automatically

**Solution**: The tables are created when the application first connects to the database. If they're not created:
1. Check the application logs for errors
2. Manually run the schema from `lib/db-schema.sql` in the Neon SQL Editor

### Free tier limits exceeded

Neon's free tier includes:
- 3 projects
- 0.5 GB storage per project
- Unlimited queries

If you exceed these limits, you can:
1. Delete unused projects
2. Upgrade to a paid plan (starts at $19/month)
3. Optimize your data storage

## Security Best Practices

1. **Never commit your connection string** to version control
2. **Use environment variables** for all sensitive data
3. **Rotate passwords** periodically in Neon settings
4. **Use read-only connections** for analytics if needed
5. **Monitor access logs** in Neon console

## Cost Considerations

### Free Tier
- Perfect for development and testing
- Suitable for low-traffic applications
- Databases pause after 5 minutes of inactivity (wake up automatically on first query)

### Paid Plans
- For production applications with consistent traffic
- No automatic pausing
- Higher storage and compute limits
- Starts at $19/month

## Next Steps

After setting up Neon:
1. Complete Discord OAuth configuration
2. Set up WalletConnect
3. Deploy your smart contracts
4. Deploy to Vercel

For more help, see:
- [README.md](README.md) - Main application documentation
- [DEPLOYMENT.md](DEPLOYMENT.md) - Vercel deployment guide
- [Neon Documentation](https://neon.tech/docs)
