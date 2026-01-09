/**
 * KV Database Browser API Endpoint
 * 
 * This endpoint allows you to browse and inspect all data stored in Upstash KV database.
 * 
 * SECURITY WARNING:
 * - This endpoint exposes ALL data in your KV database
 * - It should ONLY be used in development/staging environments
 * - Consider removing this endpoint in production or restricting access via IP allowlist
 * 
 * SETUP:
 * 1. Add DEBUG_API_KEY to your .env.local or Vercel environment variables
 *    Example: DEBUG_API_KEY=your-secure-random-string-here
 * 2. Generate a secure random string for your API key (e.g., using: openssl rand -base64 32)
 * 
 * USAGE:
 * 
 * With header authentication:
 *   curl -H "X-API-Key: your-api-key" https://your-app.vercel.app/api/debug/browse-kv
 * 
 * With query parameter:
 *   curl "https://your-app.vercel.app/api/debug/browse-kv?apiKey=your-api-key"
 * 
 * RESPONSE FORMAT:
 * {
 *   "totalKeys": 10,
 *   "keys": ["user:1", "user:2", ...],
 *   "data": {
 *     "user:1": { ... },
 *     "user:2": { ... }
 *   },
 *   "timestamp": "2024-01-09T10:30:00.000Z"
 * }
 */

import type { NextApiRequest, NextApiResponse } from 'next'

// Map STORAGE1_* prefixed environment variables to standard KV names
// This must happen BEFORE importing @vercel/kv to ensure the library finds the credentials
if (process.env.STORAGE1_KV_REST_API_URL && !process.env.KV_REST_API_URL) {
  process.env.KV_REST_API_URL = process.env.STORAGE1_KV_REST_API_URL
}
if (process.env.STORAGE1_KV_REST_API_TOKEN && !process.env.KV_REST_API_TOKEN) {
  process.env.KV_REST_API_TOKEN = process.env.STORAGE1_KV_REST_API_TOKEN
}
if (process.env.STORAGE1_KV_REST_API_READ_ONLY_TOKEN && !process.env.KV_REST_API_READ_ONLY_TOKEN) {
  process.env.KV_REST_API_READ_ONLY_TOKEN = process.env.STORAGE1_KV_REST_API_READ_ONLY_TOKEN
}
if (process.env.STORAGE1_KV_URL && !process.env.KV_URL) {
  process.env.KV_URL = process.env.STORAGE1_KV_URL
}
if (process.env.STORAGE1_REDIS_URL && !process.env.REDIS_URL) {
  process.env.REDIS_URL = process.env.STORAGE1_REDIS_URL
}

import { kv } from '@vercel/kv'

type BrowseResponse = {
  totalKeys: number
  keys: string[]
  data: Record<string, unknown>
  timestamp: string
}

type ErrorResponse = {
  error: string
}

/**
 * Validates the API key from either header or query parameter
 */
function validateApiKey(req: NextApiRequest): boolean {
  const configuredKey = process.env.DEBUG_API_KEY
  
  // If no API key is configured, deny access
  if (!configuredKey) {
    return false
  }
  
  // Check X-API-Key header first
  const headerKey = req.headers['x-api-key']
  if (headerKey && headerKey === configuredKey) {
    return true
  }
  
  // Check apiKey query parameter
  const queryKey = typeof req.query.apiKey === 'string' ? req.query.apiKey : null
  if (queryKey && queryKey === configuredKey) {
    return true
  }
  
  return false
}

/**
 * Fetches value for a key based on its Redis data type
 */
async function fetchValueByType(key: string): Promise<unknown> {
  try {
    const type = await kv.type(key)
    
    switch (type) {
      case 'string':
        return await kv.get(key)
      
      case 'hash':
        return await kv.hgetall(key)
      
      case 'set':
        return await kv.smembers(key)
      
      case 'list':
        return await kv.lrange(key, 0, -1)
      
      case 'zset':
        // For sorted sets, get all members with scores
        return await kv.zrange(key, 0, -1, { withScores: true })
      
      case 'none':
        return null
      
      default:
        return `[Unsupported type: ${type}]`
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return `[Error fetching value: ${message}]`
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BrowseResponse | ErrorResponse>
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' })
  }
  
  // Validate API key
  if (!validateApiKey(req)) {
    const configuredKey = process.env.DEBUG_API_KEY
    if (!configuredKey) {
      return res.status(401).json({
        error: 'DEBUG_API_KEY is not configured in environment variables'
      })
    }
    return res.status(401).json({
      error: 'Unauthorized. Provide valid API key via X-API-Key header or apiKey query parameter.'
    })
  }
  
  try {
    // Get all keys from KV database
    const keys = await kv.keys('*')
    
    // Fetch values for all keys
    const data: Record<string, unknown> = {}
    
    for (const key of keys) {
      data[key] = await fetchValueByType(key)
    }
    
    // Build response
    const response: BrowseResponse = {
      totalKeys: keys.length,
      keys: keys,
      data: data,
      timestamp: new Date().toISOString()
    }
    
    return res.status(200).json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to browse KV database'
    
    // Check if it's a KV configuration error
    if (error instanceof Error && error.message.includes('Missing required environment variables')) {
      return res.status(500).json({
        error: 'KV database is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN environment variables.'
      })
    }
    
    return res.status(500).json({ error: message })
  }
}
