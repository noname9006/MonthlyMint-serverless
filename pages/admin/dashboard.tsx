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
  const [discordUserId, setDiscordUserId] = useState<string | null>(null)
  
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
      // Get Discord user ID from session storage (set during Discord auth)
      const storedDiscordUserId = sessionStorage.getItem('discord_user_id')
      
      if (!storedDiscordUserId) {
        setError('Please log in with Discord first')
        setLoading(false)
        return
      }
      
      setDiscordUserId(storedDiscordUserId)
      
      try {
        const response = await fetch('/api/admin/check-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ discordUserId: storedDiscordUserId })
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
    if (!isAdmin || !discordUserId) return
    
    const loadMediaStorage = async () => {
      try {
        const response = await fetch('/api/admin/get-media-storage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-discord-user-id': discordUserId
          },
          body: JSON.stringify({ year: mediaYear, monthName: mediaMonth })
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            // Create entries for all levels
            const entries: MediaEntry[] = LEVELS.map(level => {
              const existing = data.mediaStorage.find((m: any) => m.level_name === level)
              const ipfsCid = existing ? existing.ipfs_cid : ''
              return {
                levelName: level,
                ipfsCid,
                previewUrl: ipfsCid ? `${process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs'}/${ipfsCid}` : ''
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
  }, [mediaMonth, mediaYear, isAdmin, discordUserId])

  const handleSave = async () => {
    if (!discordUserId) return
    
    setSaving(true)
    setError(null)
    setSuccess(null)
    
    try {
      // Save current month/year
      const monthResponse = await fetch('/api/admin/set-current-month', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-discord-user-id': discordUserId
        },
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
            'Content-Type': 'application/json',
            'x-discord-user-id': discordUserId
          },
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
    setMediaEntries(prev => prev.map(entry => 
      entry.levelName === levelName 
        ? { 
            ...entry, 
            ipfsCid, 
            previewUrl: ipfsCid ? `${process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs'}/${ipfsCid}` : '' 
          }
        : entry
    ))
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background py-12 px-4 flex justify-center items-center">
        <p className="text-text-primary">Loading...</p>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-background py-12 px-4 flex justify-center items-center">
        <div className="card-cyber p-8 max-w-md">
          <h1 className="text-2xl font-bold text-error mb-4">Access Denied</h1>
          <p className="text-text-secondary mb-4">{error || 'Admin privileges required'}</p>
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
      <main className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="card-cyber p-8 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold font-proxima text-text-primary uppercase">Admin Dashboard</h1>
              <button onClick={() => router.push('/')} className="btn-cyber-secondary">
                Back to Home
              </button>
            </div>
            
            <div className="divider-cyber mb-8"></div>

            {/* Current Month/Year Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold font-proxima text-text-primary uppercase mb-4">Current Month and Year</h2>
              <div className="flex gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-text-secondary mb-2">Month</label>
                  <select 
                    value={currentMonth} 
                    onChange={(e) => setCurrentMonth(e.target.value)}
                    className="w-full bg-surface border-2 border-accent text-text-primary p-3 font-proxima uppercase"
                    style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}
                  >
                    {MONTHS.map(month => (
                      <option key={month} value={month}>{month}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-text-secondary mb-2">Year</label>
                  <select 
                    value={currentYear} 
                    onChange={(e) => setCurrentYear(Number(e.target.value))}
                    className="w-full bg-surface border-2 border-accent text-text-primary p-3 font-proxima uppercase"
                    style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}
                  >
                    {YEARS.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="divider-cyber mb-8"></div>

            {/* Media Storage Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold font-proxima text-text-primary uppercase mb-4">Media Storage</h2>
              <div className="flex gap-4 flex-wrap mb-6">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-text-secondary mb-2">Month</label>
                  <select 
                    value={mediaMonth} 
                    onChange={(e) => setMediaMonth(e.target.value)}
                    className="w-full bg-surface border-2 border-accent text-text-primary p-3 font-proxima uppercase"
                    style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}
                  >
                    {MONTHS.map(month => (
                      <option key={month} value={month}>{month}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-text-secondary mb-2">Year</label>
                  <select 
                    value={mediaYear} 
                    onChange={(e) => setMediaYear(Number(e.target.value))}
                    className="w-full bg-surface border-2 border-accent text-text-primary p-3 font-proxima uppercase"
                    style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}
                  >
                    {YEARS.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Media Entries */}
              <div className="space-y-4">
                {mediaEntries.map(entry => (
                  <div key={entry.levelName} className="card-cyber p-4">
                    <div className="flex gap-4 flex-wrap items-start">
                      <div className="flex-1 min-w-[300px]">
                        <label className="block text-text-primary font-bold mb-2">{entry.levelName}</label>
                        <input
                          type="text"
                          value={entry.ipfsCid}
                          onChange={(e) => updateMediaEntry(entry.levelName, e.target.value)}
                          placeholder="Enter IPFS CID (e.g., QmXxx...)"
                          className="w-full bg-surface border-2 border-accent text-text-primary p-3 font-mono"
                          style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}
                        />
                      </div>
                      <div className="w-32 h-32">
                        {entry.previewUrl ? (
                          <img 
                            src={entry.previewUrl} 
                            alt={`${entry.levelName} preview`}
                            className="w-full h-full object-cover border-2 border-accent"
                            style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        ) : (
                          <div 
                            className="w-full h-full bg-surface border-2 border-accent flex items-center justify-center"
                            style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}
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
            <div className="divider-cyber mb-6"></div>
            <div className="flex gap-4 flex-wrap">
              <button 
                onClick={handleSave} 
                disabled={saving}
                className="btn-cyber flex-1 min-w-[200px]"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button 
                onClick={handleDiscard} 
                disabled={saving}
                className="btn-cyber-secondary flex-1 min-w-[200px]"
              >
                Discard Changes
              </button>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-error bg-opacity-10 border-2 border-error">
                <p className="text-error">{error}</p>
              </div>
            )}

            {success && (
              <div className="mt-4 p-4 bg-accent bg-opacity-10 border-2 border-accent">
                <p className="text-accent">{success}</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
