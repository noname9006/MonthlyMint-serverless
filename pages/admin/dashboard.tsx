import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

// All available levels
const LEVELS = [
  'Botanist',
  'Hyperion Ambassador',
  'Sequoia Ambassador',
  'Blossom Ambassador',
  'Seedling Ambassador',
  'Sprout'
]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030]

interface MediaEntry {
  levelName: string
  ipfsCid: string
  previewUrl: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Current month/year settings
  const [currentMonth, setCurrentMonth] = useState('January')
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [originalCurrentMonth, setOriginalCurrentMonth] = useState('January')
  const [originalCurrentYear, setOriginalCurrentYear] = useState(new Date().getFullYear())
  
  // Media storage settings
  const [mediaMonth, setMediaMonth] = useState('January')
  const [mediaYear, setMediaYear] = useState(new Date().getFullYear())
  const [mediaEntries, setMediaEntries] = useState<MediaEntry[]>([])
  const [originalMediaEntries, setOriginalMediaEntries] = useState<MediaEntry[]>([])
  
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Check if user is admin on mount
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        // Check admin status using session cookie (server-side validation)
        const response = await fetch('/api/admin/check-admin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include' // Important: include cookies
        })
        
        const data = await response.json()
        
        if (data.success && data.isAdmin) {
          setIsAdmin(true)
          // Load current settings
          await loadCurrentSettings()
        } else {
          setError('Access denied - Admin privileges required')
        }
      } catch (err) {
        setError('Failed to verify admin status')
      } finally {
        setLoading(false)
      }
    }
    
    checkAdmin()
  }, [])

  const loadCurrentSettings = async () => {
    try {
      // Load current month/year
      const monthResponse = await fetch('/api/admin/set-current-month', {
        method: 'GET'
      })
      
      if (monthResponse.ok) {
        const monthData = await monthResponse.json()
        if (monthData.success && monthData.currentMonth) {
          setCurrentMonth(monthData.currentMonth.monthName)
          setCurrentYear(monthData.currentMonth.year)
          setOriginalCurrentMonth(monthData.currentMonth.monthName)
          setOriginalCurrentYear(monthData.currentMonth.year)
        }
      }
    } catch (err) {
      console.error('Failed to load current settings:', err)
    }
  }

  // Load media storage when month/year changes
  useEffect(() => {
    if (!isAdmin) return
    
    const loadMediaStorage = async () => {
      try {
        const response = await fetch('/api/admin/get-media-storage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include', // Important: include cookies
          body: JSON.stringify({ year: mediaYear, monthName: mediaMonth })
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            // Create entries for all levels
            const entries: MediaEntry[] = LEVELS.map(level => {
              const existing = data.mediaStorage.find((m: any) => m.level_name === level)
              const ipfsCid = existing ? existing.ipfs_cid : ''
              const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs'
              return {
                levelName: level,
                ipfsCid,
                previewUrl: ipfsCid ? `${gateway}/${ipfsCid}` : ''
              }
            })
            setMediaEntries(entries)
            setOriginalMediaEntries(JSON.parse(JSON.stringify(entries)))
          }
        }
      } catch (err) {
        console.error('Failed to load media storage:', err)
      }
    }
    
    loadMediaStorage()
  }, [mediaMonth, mediaYear, isAdmin])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    
    try {
      // Save current month/year
      const monthResponse = await fetch('/api/admin/set-current-month', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Important: include cookies
        body: JSON.stringify({ monthName: currentMonth, year: currentYear })
      })
      
      if (!monthResponse.ok) {
        throw new Error('Failed to save current month/year')
      }
      
      // Save media storage updates
      const mediaUpdates = mediaEntries
        .filter(entry => entry.ipfsCid.trim() !== '')
        .map(entry => ({
          levelName: entry.levelName,
          year: mediaYear,
          monthName: mediaMonth,
          ipfsCid: entry.ipfsCid.trim()
        }))
      
      if (mediaUpdates.length > 0) {
        const mediaResponse = await fetch('/api/admin/update-media-storage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include', // Important: include cookies
          body: JSON.stringify({ mediaUpdates })
        })
        
        if (!mediaResponse.ok) {
          throw new Error('Failed to save media storage')
        }
      }
      
      // Update original values
      setOriginalCurrentMonth(currentMonth)
      setOriginalCurrentYear(currentYear)
      setOriginalMediaEntries(JSON.parse(JSON.stringify(mediaEntries)))
      
      setSuccess('Settings saved successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setCurrentMonth(originalCurrentMonth)
    setCurrentYear(originalCurrentYear)
    setMediaEntries(JSON.parse(JSON.stringify(originalMediaEntries)))
    setError(null)
    setSuccess(null)
  }

  const updateMediaEntry = (levelName: string, ipfsCid: string) => {
    const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs'
    setMediaEntries(prev => prev.map(entry => 
      entry.levelName === levelName 
        ? { 
            ...entry, 
            ipfsCid, 
            previewUrl: ipfsCid ? `${gateway}/${ipfsCid}` : '' 
          }
        : entry
    ))
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background py-6 sm:py-12 px-2 sm:px-4 flex justify-center items-center">
        <p className="text-text-primary">Loading...</p>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-background py-6 sm:py-12 px-2 sm:px-4 flex justify-center items-center">
        <div className="card-cyber p-4 sm:p-8 max-w-md w-full">
          <h1 className="text-xl sm:text-2xl font-bold text-error mb-3 sm:mb-4">Access Denied</h1>
          <p className="text-text-secondary mb-3 sm:mb-4 text-sm sm:text-base">{error || 'Admin privileges required'}</p>
          <button onClick={() => router.push('/')} className="btn-cyber w-full">
            Return to Home
          </button>
        </div>
      </main>
    )
  }

  return (
    <>
      <Head>
        <title>Admin Dashboard - Botanix Ambassador Program</title>
      </Head>
      <main className="min-h-screen bg-background py-6 sm:py-8 px-2 sm:px-4">
        <div className="max-w-5xl mx-auto">
          <div className="card-cyber p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold font-proxima text-text-primary uppercase">Admin Dashboard</h1>
              <button onClick={() => router.push('/')} className="btn-cyber-secondary text-sm sm:text-base px-4 py-2">
                Back to Home
              </button>
            </div>
            
            <div className="divider-cyber mb-4 sm:mb-6"></div>

            {/* Current Month/Year Section */}
            <div className="mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-bold font-proxima text-text-primary uppercase mb-3">Current Month and Year</h2>
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-text-secondary mb-1 text-sm">Month</label>
                  <select 
                    value={currentMonth} 
                    onChange={(e) => setCurrentMonth(e.target.value)}
                    className="w-full bg-surface border border-accent text-text-primary p-2 font-proxima uppercase text-sm"
                    style={{ borderRadius: '4px' }}
                  >
                    {MONTHS.map(month => (
                      <option key={month} value={month}>{month}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-text-secondary mb-1 text-sm">Year</label>
                  <select 
                    value={currentYear} 
                    onChange={(e) => setCurrentYear(Number(e.target.value))}
                    className="w-full bg-surface border border-accent text-text-primary p-2 font-proxima uppercase text-sm"
                    style={{ borderRadius: '4px' }}
                  >
                    {YEARS.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="divider-cyber mb-4 sm:mb-6"></div>

            {/* Media Storage Section */}
            <div className="mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-bold font-proxima text-text-primary uppercase mb-3">Media Storage</h2>
              <div className="flex gap-3 flex-wrap mb-4">
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-text-secondary mb-1 text-sm">Month</label>
                  <select 
                    value={mediaMonth} 
                    onChange={(e) => setMediaMonth(e.target.value)}
                    className="w-full bg-surface border border-accent text-text-primary p-2 font-proxima uppercase text-sm"
                    style={{ borderRadius: '4px' }}
                  >
                    {MONTHS.map(month => (
                      <option key={month} value={month}>{month}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-text-secondary mb-1 text-sm">Year</label>
                  <select 
                    value={mediaYear} 
                    onChange={(e) => setMediaYear(Number(e.target.value))}
                    className="w-full bg-surface border border-accent text-text-primary p-2 font-proxima uppercase text-sm"
                    style={{ borderRadius: '4px' }}
                  >
                    {YEARS.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Media Entries */}
              <div className="space-y-3">
                {mediaEntries.map(entry => (
                  <div key={entry.levelName} className="pb-3 border-b border-accent border-opacity-20 last:border-0">
                    <div className="flex gap-3 flex-wrap items-start">
                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-text-primary font-bold mb-1 text-sm">{entry.levelName}</label>
                        <input
                          type="text"
                          value={entry.ipfsCid}
                          onChange={(e) => updateMediaEntry(entry.levelName, e.target.value)}
                          placeholder="Enter IPFS CID (e.g., QmXxx...)"
                          className="w-full bg-surface border border-accent text-text-primary p-2 font-mono text-xs"
                          style={{ borderRadius: '4px' }}
                        />
                      </div>
                      <div className="w-20 h-20 sm:w-24 sm:h-24">
                        {entry.previewUrl ? (
                          <img 
                            src={entry.previewUrl} 
                            alt={`${entry.levelName} preview`}
                            className="w-full h-full object-cover border border-accent"
                            style={{ borderRadius: '4px' }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        ) : (
                          <div 
                            className="w-full h-full bg-surface border border-accent flex items-center justify-center"
                            style={{ borderRadius: '4px' }}
                          >
                            <span className="text-text-secondary text-xs">No preview</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="divider-cyber mb-4"></div>
            <div className="flex gap-3 flex-wrap">
              <button 
                onClick={handleSave} 
                disabled={saving}
                className="btn-cyber flex-1 min-w-[150px] text-sm sm:text-base"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button 
                onClick={handleDiscard} 
                disabled={saving}
                className="btn-cyber-secondary flex-1 min-w-[150px] text-sm sm:text-base"
              >
                Discard Changes
              </button>
            </div>

            {error && (
              <div className="mt-3 p-3 bg-error bg-opacity-10 border border-error" style={{ borderRadius: '4px' }}>
                <p className="text-error text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="mt-3 p-3 bg-accent bg-opacity-10 border border-accent" style={{ borderRadius: '4px' }}>
                <p className="text-accent text-sm">{success}</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
