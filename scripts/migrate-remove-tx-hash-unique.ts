/**
 * Migration script to remove UNIQUE constraint from transaction_hash in nft_mint_events table
 * 
 * This fixes the batch minting issue where multiple NFTs sharing the same transaction hash
 * could not be logged in the database.
 * 
 * Run with: npx ts-node scripts/migrate-remove-tx-hash-unique.ts
 */

import { neon } from '@neondatabase/serverless'

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is not set')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

async function migrate() {
  console.log('Starting migration to remove UNIQUE constraint from transaction_hash...')
  
  try {
    // Check if the unique constraint exists
    const constraints = await sql`
      SELECT con.conname AS constraint_name
      FROM pg_catalog.pg_constraint con
      INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
      INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = connamespace
      WHERE nsp.nspname = 'public'
        AND rel.relname = 'nft_mint_events'
        AND con.contype = 'u'
    `
    
    console.log('Found constraints:', constraints)
    
    // Find the constraint on transaction_hash
    const txHashConstraint = constraints.find((c: any) => {
      // The constraint name is usually something like "nft_mint_events_transaction_hash_key"
      return c.constraint_name.includes('transaction_hash')
    })
    
    if (txHashConstraint) {
      console.log(`Found UNIQUE constraint on transaction_hash: ${txHashConstraint.constraint_name}`)
      
      // Validate constraint name to prevent SQL injection
      const constraintName = txHashConstraint.constraint_name
      if (!/^[a-zA-Z0-9_]+$/.test(constraintName)) {
        throw new Error(`Invalid constraint name format: ${constraintName}`)
      }
      
      console.log('Dropping constraint...')
      
      // Use raw SQL with validated constraint name (Neon doesn't support identifier escaping in tagged templates)
      await sql.unsafe(`ALTER TABLE nft_mint_events DROP CONSTRAINT ${constraintName}`)
      
      console.log('✅ Successfully removed UNIQUE constraint from transaction_hash')
    } else {
      console.log('✅ No UNIQUE constraint found on transaction_hash - already migrated or never existed')
    }
    
    // Verify the table structure
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'nft_mint_events'
      ORDER BY ordinal_position
    `
    
    console.log('\nCurrent nft_mint_events table structure:')
    console.table(columns)
    
    // Re-fetch constraints to check current state after dropping transaction_hash constraint
    const currentConstraints = await sql`
      SELECT con.conname AS constraint_name
      FROM pg_catalog.pg_constraint con
      INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
      INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = connamespace
      WHERE nsp.nspname = 'public'
        AND rel.relname = 'nft_mint_events'
        AND con.contype = 'u'
    `
    
    // Check if request_id has UNIQUE constraint (it should)
    const requestIdConstraint = currentConstraints.find((c: any) => {
      return c.constraint_name.includes('request_id')
    })
    
    if (requestIdConstraint) {
      console.log('✅ request_id UNIQUE constraint exists:', requestIdConstraint.constraint_name)
    } else {
      console.log('⚠️  Warning: request_id does not have a UNIQUE constraint')
      console.log('Adding UNIQUE constraint to request_id...')
      
      try {
        await sql`
          ALTER TABLE nft_mint_events 
          ADD CONSTRAINT nft_mint_events_request_id_key UNIQUE (request_id)
        `
        console.log('✅ Added UNIQUE constraint to request_id')
      } catch (error: any) {
        if (error.message.includes('already exists')) {
          console.log('✅ UNIQUE constraint already exists on request_id')
        } else {
          throw error
        }
      }
    }
    
    console.log('\n✅ Migration completed successfully!')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

migrate()
  .then(() => {
    console.log('Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Failed:', error)
    process.exit(1)
  })
