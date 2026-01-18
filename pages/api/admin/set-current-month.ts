import type { NextApiRequest, NextApiResponse } from 'next'

// In-memory storage for current month (in production, use database or env variable)
// This will be reset on serverless function cold start, which is acceptable
// For production, consider storing in database or using environment variables
let currentMonth = {
  monthName: 'January',
  year: new Date().getFullYear()
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Simple admin authentication - check for admin secret
  const adminSecret = req.headers['x-admin-secret'] as string
  const expectedSecret = process.env.ADMIN_SECRET
  
  if (!expectedSecret || adminSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    // Get current month
    return res.json({
      success: true,
      currentMonth
    })
  }

  if (req.method === 'POST') {
    // Set current month
    const { monthName, year } = req.body

    if (!monthName || !year) {
      return res.status(400).json({ error: 'monthName and year are required' })
    }

    // Validate month name
    const validMonths = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December']
    if (!validMonths.includes(monthName)) {
      return res.status(400).json({ error: 'Invalid month name' })
    }

    // Validate year
    if (typeof year !== 'number' || year < 2024) {
      return res.status(400).json({ error: 'Invalid year (must be >= 2024)' })
    }

    currentMonth = { monthName, year }

    return res.json({
      success: true,
      currentMonth
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// Export getter for other API routes to access current month
export function getCurrentMonth() {
  return currentMonth
}
