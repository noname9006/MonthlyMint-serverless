-- Migration: Remove deprecated columns from nft_mint_events table
-- Date: 2026-01-22
-- Description: Remove credential_type, metadata, and level columns that are no longer used

-- Drop the deprecated columns
ALTER TABLE nft_mint_events DROP COLUMN IF EXISTS credential_type;
ALTER TABLE nft_mint_events DROP COLUMN IF EXISTS metadata;
ALTER TABLE nft_mint_events DROP COLUMN IF EXISTS level;
