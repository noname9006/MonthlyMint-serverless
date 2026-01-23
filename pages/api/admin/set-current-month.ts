import type { NextApiRequest, NextApiResponse } from 'next'
import { getCurrentMonthSetting, setCurrentMonthSetting } from '@/lib/db'
import { validateAdminSession } from '@/lib/session'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Public endpoint - anyone can get current month
    try {
      const currentMonth = await getCurrentMonthSetting()
      
      if (!currentMonth) {
        // Return default if not set
        return res.json({
          success: true,
          currentMonth: {
            monthName: 'January',
            year: new Date().getFullYear()
          }
        })
      }
      
      return res.json({
        success: true,
        currentMonth: {
          monthName: currentMonth.month_name,
          year: currentMonth.year
        }
      })
    } catch (error) {
      console.error('Error fetching current month:', error)
      return res.status(500).json({ error: 'Failed to fetch current month' })
    }
  }

  if (req.method === 'POST') {
    // Admin-only endpoint - validate session
    const discordUserId = await validateAdminSession(req)
    
    if (!discordUserId) {
      return res.status(401).json({ error: 'Unauthorized - Admin access required' })
    }

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

    try {
      const currentMonth = await setCurrentMonthSetting(monthName, year)

      return res.json({
        success: true,
        currentMonth: {
          monthName: currentMonth.month_name,
          year: currentMonth.year
        }
      })
    } catch (error) {
      console.error('Error setting current month:', error)
      return res.status(500).json({ error: 'Failed to set current month' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
