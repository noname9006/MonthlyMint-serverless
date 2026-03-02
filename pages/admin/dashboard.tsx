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
        const response = await fetch('/api/admin/check-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        })
        const data = await response.json()
        if (data.success && data.isAdmin) {
          setIsAdmin(true)
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
      const monthResponse = await fetch('/api/admin/set-current-month', { method: 'GET' })
      if (monthResponse.ok) {
        const monthData = await monthResponse.json()
        if (monthData.success && monthData.currentMonth) {
          setCurrentMonth(monthData.currentMonth.monthName)
          setCurrentYear(monthData.currentMonth.year)
          setOriginalCurrentMonth(monthData.currentMonth.monthName)
          setOriginalCurrentYear(monthData.currentMonth.year)
          setMediaMonth(monthData.currentMonth.monthName)
          setMediaYear(monthData.currentMonth.year)
        }
      }
    } catch (err) {
      console.error('Failed to load current settings:', err)
    }
  }

  useEffect(() => {
    if (!isAdmin) return
    const loadMediaStorage = async () => {
      try {
        const response = await fetch('/api/admin/get-media-storage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ year: mediaYear, monthName: mediaMonth })
        })
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            const entries: MediaEntry[] = LEVELS.map(level => {
              const existing = data.mediaStorage.find((m: any) => m.level_name === level)
              const ipfsCid = existing ? existing.ipfs_cid : ''
              const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs'
              return { levelName: level, ipfsCid, previewUrl: ipfsCid ? `${gateway}/${ipfsCid}` : '' }
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
      const monthResponse = await fetch('/api/admin/set-current-month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ monthName: currentMonth, year: currentYear })
      })
      if (!monthResponse.ok) throw new Error('Failed to save current month/year')

      const mediaUpdates = mediaEntries
        .filter(entry => entry.ipfsCid.trim() !== '')
        .map(entry => ({ levelName: entry.levelName, year: mediaYear, monthName: mediaMonth, ipfsCid: entry.ipfsCid.trim() }))
      
      if (mediaUpdates.length > 0) {
        const mediaResponse = await fetch('/api/admin/update-media-storage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ mediaUpdates })
        })
        if (!mediaResponse.ok) throw new Error('Failed to save media storage')
      }

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
        ? { ...entry, ipfsCid, previewUrl: ipfsCid ? `${gateway}/${ipfsCid}` : '' }
        : entry
    ))
  }

  const selectStyle: React.CSSProperties = {
    background: 'rgba(120,120,120,0.2)',
    border: '1px solid #ffd966',
    borderRadius: '2px',
    padding: '8px 12px',
    color: '#fff',
    fontFamily: "'Courier New', monospace",
    fontSize: '0.85rem',
    textTransform: 'uppercase',
    width: '100%',
    cursor: 'pointer',
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(120,120,120,0.2)',
    border: '1px dashed #ffd966',
    borderRadius: '2px',
    padding: '8px 12px',
    color: '#fff',
    fontFamily: "'Courier New', monospace",
    fontSize: '0.8rem',
    width: '100%',
    boxSizing: 'border-box',
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <p style={{ fontFamily: "'Courier New', monospace", color: '#ffd966' }}>[ LOADING... ]</p>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative', zIndex: 1 }}>
        <div className="bento-card" style={{ maxWidth: '420px', width: '100%' }}>
          <p className="step-indicator">ACCESS DENIED</p>
          <h1 style={{ margin: '4px 0 16px', fontSize: '1.25rem', fontWeight: 900, color: '#ff3366', textTransform: 'uppercase' }}>
            Admin Required
          </h1>
          <p className="data-point" style={{ marginBottom: '16px' }}>{error || 'Admin privileges required'}</p>
          <button onClick={() => router.push('/')} className="mint-button" style={{ fontSize: '0.85rem', padding: '12px' }}>
            RETURN TO HOME
          </button>
        </div>
      </main>
    )
  }

  return (
    <>
      <Head>
        <title>Admin Dashboard — Botanix Ambassador Program</title>
      </Head>
      <main style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '40px 20px' }}>

        {/* Branding header */}
        <div style={{ textAlign: 'center', marginBottom: '32px', width: '100%', maxWidth: '900px' }}>
          <p style={{ fontFamily: "'Courier New', monospace", fontSize: '1.5rem', fontWeight: 900, color: '#ffd966', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
            Botanix • Ambassador Program
          </p>
          <p style={{ fontFamily: "'Courier New', monospace", fontSize: '0.8rem', color: '#bbb', marginTop: '4px', letterSpacing: '0.05em' }}>
            ADMIN // CONTROL PANEL
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', maxWidth: '900px', width: '100%' }}>

          {/* Card: Current Mint Period */}
          <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <p className="step-indicator">SYS // CONFIG</p>
              <h2 style={{ margin: '4px 0 0', fontSize: '1.1rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mint Period</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <p className="data-point" style={{ marginBottom: '6px' }}>MONTH:</p>
                <select value={currentMonth} onChange={e => setCurrentMonth(e.target.value)} style={selectStyle}>
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <p className="data-point" style={{ marginBottom: '6px' }}>YEAR:</p>
                <select value={currentYear} onChange={e => setCurrentYear(Number(e.target.value))} style={selectStyle}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <p className="data-point" style={{ marginTop: 'auto' }}>
              CURRENT: <span className="data-highlight">{currentMonth.toUpperCase()} {currentYear}</span>
            </p>
          </div>

          {/* Card: Media Period Selector */}
          <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <p className="step-indicator">MEDIA // PERIOD</p>
              <h2 style={{ margin: '4px 0 0', fontSize: '1.1rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Media Storage</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <p className="data-point" style={{ marginBottom: '6px' }}>MONTH:</p>
                <select value={mediaMonth} onChange={e => setMediaMonth(e.target.value)} style={selectStyle}>
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <p className="data-point" style={{ marginBottom: '6px' }}>YEAR:</p>
                <select value={mediaYear} onChange={e => setMediaYear(Number(e.target.value))} style={selectStyle}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <p className="data-point" style={{ marginTop: 'auto' }}>
              VIEWING: <span className="data-highlight">{mediaMonth.toUpperCase()} {mediaYear}</span>
            </p>
          </div>

        </div>

        {/* Media entries card — full width */}
        <div className="bento-card" style={{ maxWidth: '900px', width: '100%', marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <p className="step-indicator">MEDIA // IPFS REGISTRY</p>
            <h2 style={{ margin: '4px 0 0', fontSize: '1.1rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              NFT Media — {mediaMonth.toUpperCase()} {mediaYear}
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {mediaEntries.map((entry, i) => (
              <div key={entry.levelName} style={{ display: 'flex', gap: '12px', alignItems: 'center', paddingBottom: i < mediaEntries.length - 1 ? '12px' : 0, borderBottom: i < mediaEntries.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                <div style={{ flex: 1 }}>
                  <p className="data-point" style={{ marginBottom: '4px', color: '#ffd966' }}>{entry.levelName.toUpperCase()}</p>
                  <input
                    type="text"
                    value={entry.ipfsCid}
                    onChange={e => updateMediaEntry(entry.levelName, e.target.value)}
                    placeholder="IPFS CID (e.g. QmXxx...)"
                    style={inputStyle}
                  />
                </div>
                <div style={{ width: '64px', height: '64px', flexShrink: 0 }}>
                  {entry.previewUrl ? (
                    <img
                      src={entry.previewUrl}
                      alt={`${entry.levelName} preview`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', border: '1px solid #ffd966', borderRadius: 0 }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', border: '1px dashed rgba(255,217,102,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.6rem', color: '#bbb' }}>N/A</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ maxWidth: '900px', width: '100%', marginTop: '24px', display: 'flex', gap: '16px' }}>
          <button onClick={handleSave} disabled={saving} className="mint-button" style={{ flex: 1 }}>
            {saving ? 'SAVING...' : 'SAVE CHANGES'}
          </button>
          <button onClick={handleDiscard} disabled={saving} className="logout-button" style={{ flex: 1 }}>
            DISCARD CHANGES
          </button>
          <button onClick={() => router.push('/')} className="mint-button" style={{ flex: 1, fontSize: '0.85rem', padding: '12px', background: 'transparent', color: '#ffd966', border: '1px solid #ffd966' }}>
            ← BACK TO HOME
          </button>
        </div>

        {/* Feedback */}
        {error && (
          <div style={{ maxWidth: '900px', width: '100%', marginTop: '16px', padding: '12px', border: '1px solid #ff3366', background: 'rgba(255,51,102,0.08)' }}>
            <p style={{ fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: '#ff3366', margin: 0 }}>{error}</p>
          </div>
        )}
        {success && (
          <div style={{ maxWidth: '900px', width: '100%', marginTop: '16px', padding: '12px', border: '1px solid #ffd966', background: 'rgba(255,217,102,0.08)' }}>
            <p style={{ fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: '#ffd966', margin: 0 }}>{success}</p>
          </div>
        )}
      </main>
    </>
  )
}
