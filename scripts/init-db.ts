import { initDatabase } from '../lib/db'

console.log('Initializing database...')

try {
  initDatabase()
  console.log('✅ Database initialized successfully!')
  console.log('Using Vercel KV (Redis-based storage)')
  console.log('Note: In production, Vercel KV is automatically configured when you link a KV database to your project')
  console.log('For local development, ensure KV_REST_API_URL and KV_REST_API_TOKEN are set in .env.local')
} catch (error) {
  console.error('❌ Failed to initialize database:', error)
  process.exit(1)
}
