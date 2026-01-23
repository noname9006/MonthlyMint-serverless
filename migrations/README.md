# Database Migrations

This directory contains SQL migration scripts for the MonthlyMint database.

## Running Migrations

Migrations should be run manually using your database management tool or command line:

### Using Neon Console (Web UI)
1. Log into your Neon database console at https://console.neon.tech
2. Navigate to your database
3. Open the SQL Editor
4. Copy and paste the migration SQL
5. Execute the query

### Using psql (Command Line)
```bash
psql -h <your-neon-host> -U <your-user> -d <your-database> -f migrations/001_remove_deprecated_columns.sql
```

### Using Environment Variable
```bash
psql $DATABASE_URL -f migrations/001_remove_deprecated_columns.sql
```

## Migration History

- **001_remove_deprecated_columns.sql** (2026-01-22)
  - Removes deprecated `credential_type`, `metadata`, and `level` columns from `nft_mint_events` table
  - These fields are no longer used in the application
  - Contract compatibility is maintained by passing empty strings for these parameters

## Notes

- Always backup your database before running migrations
- Test migrations in a development environment first
- Migrations use `DROP COLUMN IF EXISTS` to be idempotent and safe to run multiple times
