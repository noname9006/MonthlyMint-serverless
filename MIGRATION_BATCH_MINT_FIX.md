# Database Migration Guide

## Removing UNIQUE Constraint from transaction_hash

### Why This Migration is Needed

The `nft_mint_events` table previously had a UNIQUE constraint on the `transaction_hash` column. This prevented multiple NFTs from a batch mint transaction (which all share the same transaction hash) from being logged in the database.

This migration removes that constraint to allow batch minting to work correctly.

### Prerequisites

- Access to the production database
- `DATABASE_URL` environment variable set in your `.env.local` or environment

### Running the Migration

1. **Backup your database** (recommended):
   ```bash
   # If using Neon, use the Neon dashboard to create a snapshot
   # Or export your data using pg_dump if available
   ```

2. **Run the migration script**:
   ```bash
   npx ts-node scripts/migrate-remove-tx-hash-unique.ts
   ```

3. **Verify the migration**:
   The script will output:
   - Current constraints on the table
   - Whether the UNIQUE constraint was found and removed
   - Current table structure
   - Confirmation that `request_id` has a UNIQUE constraint

### Expected Output

```
Starting migration to remove UNIQUE constraint from transaction_hash...
Found constraints: [...]
Found UNIQUE constraint on transaction_hash: nft_mint_events_transaction_hash_key
Dropping constraint...
✅ Successfully removed UNIQUE constraint from transaction_hash

Current nft_mint_events table structure:
[Table showing all columns]

✅ request_id UNIQUE constraint exists: nft_mint_events_request_id_key
✅ Migration completed successfully!
Done!
```

### What This Migration Does

1. Checks for existing UNIQUE constraint on `transaction_hash`
2. Drops the constraint if found
3. Verifies `request_id` has a UNIQUE constraint (adds it if missing)
4. Shows the final table structure

### After Migration

After running this migration:
- Batch minting of multiple NFTs in a single transaction will work correctly
- Each NFT in the batch will be logged with its unique `request_id`
- The transaction hash will be stored but not enforced as unique
- Idempotency for batch mints is now handled via `request_id` instead of `transaction_hash`

### Troubleshooting

**Error: "permission denied"**
- Ensure your database user has ALTER TABLE permissions

**Error: "relation 'nft_mint_events' does not exist"**
- The table hasn't been created yet. Run the app first to create the schema.

**No constraint found**
- If the migration says no constraint was found, it means either:
  - The migration was already run
  - The table was created with the updated schema
  - This is fine and no action is needed

### Rollback (Not Recommended)

If you need to rollback for some reason:
```sql
ALTER TABLE nft_mint_events ADD CONSTRAINT nft_mint_events_transaction_hash_key UNIQUE (transaction_hash);
```

⚠️ **Warning**: This will prevent batch minting from working correctly.
