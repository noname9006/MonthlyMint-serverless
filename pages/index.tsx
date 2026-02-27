import { useEffect, useMemo, useState, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useDisconnect } from 'wagmi'
import { SBTMinter, type SBTMinterHandle, type UnmintedLowerTier } from '@/components/SBTMinter'
import { chainConfig } from '@/lib/chains'
import { ROLE_HIERARCHY } from '@/lib/discord'
import { ipfsToGateway, getMediaURI } from '@/lib/media-config'

import type { RoleName } from '@/lib/discord'

type DiscordUser = {
  id: string
  username: string
  global_name?: string
  avatar?: string | null
}

type GuildMember = {
  roles?: string[]
  joined_at?: string
}

type DiscordAuthMessage =
  | { source: 'discord-auth'; status: 'success'; user: DiscordUser; member: GuildMember | null; highestRole: { id: string; name: RoleName } | null }
  | { source: 'discord-auth'; status: 'error'; error: string }

// Discord popup timing constants
const DISCORD_POPUP_TIMEOUT = 60000 // 60 seconds before timing out
const DISCORD_POPUP_CHECK_INTERVAL = 2000 // Check popup status every 2 seconds
const DISCORD_POSTMESSAGE_DELAY = 500 // Wait 500ms for postMessage to complete

export default function Home() {
  const router = useRouter()
  const [discordUser, setDiscordUser] = useState<DiscordUser | null>(null)
  const [guildMember, setGuildMember] = useState<GuildMember | null>(null)
  const [highestRole, setHighestRole] = useState<{ id: string; name: RoleName } | null>(null)
  const [discordLoading, setDiscordLoading] = useState(false)
  const [discordError, setDiscordError] = useState<string | null>(null)
  const [alreadyMinted, setAlreadyMinted] = useState(false)
  const [hasLowerTierAvailable, setHasLowerTierAvailable] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const sbtMinterRef = useRef<SBTMinterHandle>(null)
  const [mintError, setMintError] = useState<string | null>(null)
  const [mintSuccess, setMintSuccess] = useState<string | null>(null)
  const [mintLoading, setMintLoading] = useState(false)
  const [currentMonth, setCurrentMonth] = useState<{ monthName: string; year: number } | null>(null)
  const [mediaURI, setMediaURI] = useState<string | null>(null)
  const [isLoadingMedia, setIsLoadingMedia] = useState(false)
  const [unmintedLowerTiers, setUnmintedLowerTiers] = useState<UnmintedLowerTier[]>([])

  const FALLBACK_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect width="200" height="200" fill="%23334155"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="14"%3EImage not available%3C/text%3E%3C/svg%3E'

  // Update hasLowerTierAvailable whenever unmintedLowerTiers changes
  useEffect(() => {
    setHasLowerTierAvailable(unmintedLowerTiers.length > 0)
  }, [unmintedLowerTiers])

  // Only check discordUser for verification, not guildMember
  // This allows users to proceed even if guild member check fails
  // Guild membership and roles are validated server-side during minting
  const isDiscordVerified = useMemo(() => Boolean(discordUser), [discordUser])

  // Wallet connection tracking
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const lastLoggedAddress = useRef<string | undefined>(undefined)
  
  // Check if user is eligible to proceed to mint (both Discord and wallet connected, has role)
  const canProceedToMint = useMemo(() => {
    return isDiscordVerified && isConnected && Boolean(highestRole) && Boolean(guildMember)
  }, [isDiscordVerified, isConnected, highestRole, guildMember])
  
  // Discord popup timer management
  const discordPopupTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const discordPopupIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Helper function to clear Discord popup timers
  const clearDiscordTimers = () => {
    if (discordPopupTimeoutRef.current) {
      clearTimeout(discordPopupTimeoutRef.current)
      discordPopupTimeoutRef.current = null
    }
    if (discordPopupIntervalRef.current) {
      clearInterval(discordPopupIntervalRef.current)
      discordPopupIntervalRef.current = null
    }
  }

  // Check mint status when wallet and Discord are connected
  useEffect(() => {
    if (isConnected && isDiscordVerified && discordUser && highestRole) {
      fetch('/api/nft/check-mint-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordId: discordUser.id,
          roleName: highestRole.name,
        }),
      })
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`)
          }
          return res.json()
        })
        .then(data => {
          if (data.success) {
            setAlreadyMinted(data.alreadyMinted)
            setHasLowerTierAvailable(data.hasLowerTierAvailable)
          }
        })
        .catch(err => {
          console.error('Failed to check mint status:', err)
        })
    }
  }, [isConnected, isDiscordVerified, discordUser, highestRole])

  // Check admin status when Discord user changes
  useEffect(() => {
    if (discordUser) {
      // Check if user is admin using session-based auth
      fetch('/api/admin/check-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include' // Include session cookies
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.isAdmin) {
            setIsAdmin(true)
          } else {
            setIsAdmin(false)
          }
        })
        .catch(err => {
          console.error('Failed to check admin status:', err)
          setIsAdmin(false)
        })
    } else {
      setIsAdmin(false)
    }
  }, [discordUser])

  // Load Discord auth from session storage on mount (5-minute persistence)
  // Role verification happens server-side during minting, so we don't re-verify here
  useEffect(() => {
    try {
      const storedAuthStr = sessionStorage.getItem('discord_auth')
      if (!storedAuthStr) return
      
      const storedAuth = JSON.parse(storedAuthStr)
      const now = Date.now()
      const authAge = now - storedAuth.timestamp
      const FIVE_MINUTES_MS = 5 * 60 * 1000
      
      // Check if auth is still valid (within 5 minutes)
      if (authAge > FIVE_MINUTES_MS) {
        console.log('Stored Discord auth expired (>5 minutes), clearing...')
        sessionStorage.removeItem('discord_auth')
        return
      }
      
      // Auth is still valid - restore user state
      console.log('Restoring Discord auth from session storage (valid for', Math.round((FIVE_MINUTES_MS - authAge) / 1000), 'more seconds)')
      setDiscordUser(storedAuth.user)
      setGuildMember(storedAuth.member)
      setHighestRole(storedAuth.highestRole)
      
      // Note: Roles will be re-verified server-side during minting
      // The signature generation endpoints check roles in real-time
    } catch (err) {
      console.error('Error loading stored Discord auth:', err)
      sessionStorage.removeItem('discord_auth')
    }
  }, [])

  useEffect(() => {
    const handleMessage = (event: MessageEvent<DiscordAuthMessage>) => {
      if (!event.data || event.data.source !== 'discord-auth') return

      // Clear timeout and interval since auth completed
      clearDiscordTimers()

      if (event.data.status === 'success') {
        setDiscordUser(event.data.user)
        setGuildMember(event.data.member)
        setHighestRole(event.data.highestRole)
        setDiscordError(null)
        
        // Store auth in session storage with timestamp for 5-minute persistence
        const authData = {
          user: event.data.user,
          member: event.data.member,
          highestRole: event.data.highestRole,
          timestamp: Date.now()
        }
        sessionStorage.setItem('discord_auth', JSON.stringify(authData))
      } else {
        setDiscordError(event.data.error || 'Не удалось авторизоваться через Discord')
        setDiscordUser(null)
        setGuildMember(null)
        setHighestRole(null)
        sessionStorage.removeItem('discord_auth')
      }
      setDiscordLoading(false)
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Monitor wallet connection changes
  useEffect(() => {
    // Skip if no Discord user
    if (!discordUser) return

    const currentAddress = address?.toLowerCase()
    const lastAddress = lastLoggedAddress.current

    // Wallet connected or changed
    if (isConnected && currentAddress && currentAddress !== lastAddress) {
      fetch('/api/wallet/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordId: discordUser.id,
          walletAddress: currentAddress,
          action: 'connected',
        }),
      }).catch(err => console.error('Failed to log wallet connection:', err))

      lastLoggedAddress.current = currentAddress
    }
    // Wallet disconnected
    else if (!isConnected && lastAddress) {
      fetch('/api/wallet/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordId: discordUser.id,
          walletAddress: lastAddress,
          action: 'disconnected',
        }),
      }).catch(err => console.error('Failed to log wallet disconnection:', err))

      lastLoggedAddress.current = undefined
    }
  }, [address, isConnected, discordUser])

  const avatarUrl =
    discordUser && discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`
      : null

  // Fetch current month on mount
  useEffect(() => {
    fetch('/api/admin/set-current-month', { method: 'GET' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.success && data.currentMonth) {
          setCurrentMonth(data.currentMonth)
        }
      })
      .catch(() => {})
  }, [])

  // Compute tenure (days since guild join)
  const tenureDays = useMemo(() => {
    if (!guildMember?.joined_at) return null
    const joined = new Date(guildMember.joined_at)
    const now = new Date()
    const diff = Math.floor((now.getTime() - joined.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }, [guildMember])

  // Compute NFT tier number (0-5) from role priority (1-6 → tier 5-0)
  const tierNumber = useMemo(() => {
    if (!highestRole) return null
    const roleEntry = ROLE_HIERARCHY.find(r => r.name === highestRole.name)
    if (!roleEntry) return null
    return ROLE_HIERARCHY.length - roleEntry.priority
  }, [highestRole])

  // Fetch media for NFT preview when role + month are both known
  useEffect(() => {
    if (!highestRole || !currentMonth) {
      setMediaURI(null)
      return
    }
    const fetchMedia = async () => {
      setIsLoadingMedia(true)
      try {
        const res = await fetch('/api/nft/get-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ levelName: highestRole.name, year: currentMonth.year, monthName: currentMonth.monthName }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.ipfsCid) {
            setMediaURI(`ipfs://${data.ipfsCid}`)
            return
          }
        }
      } catch { /* fall through to env fallback */ }
      setMediaURI(getMediaURI(highestRole.name, currentMonth.year, currentMonth.monthName))
    }
    fetchMedia().finally(() => setIsLoadingMedia(false))
  }, [highestRole, currentMonth])

  const mediaGatewayURL = mediaURI ? ipfsToGateway(mediaURI) : null

  const openDiscordPopup = () => {
    setDiscordError(null)
    setDiscordLoading(true)

    const width = 520
    const height = 720
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    const popup = window.open(
      '/api/auth/discord/login',
      'discord-auth',
      `width=${width},height=${height},left=${left},top=${top},resizable=no,scrollbars=yes`
    )

    if (!popup) {
      setDiscordLoading(false)
      setDiscordError('Разрешите всплывающие окна, чтобы авторизоваться через Discord')
      return
    }

    // Set timeout to reset loading state after configured timeout
    discordPopupTimeoutRef.current = setTimeout(() => {
      clearDiscordTimers()
      if (popup && !popup.closed) {
        popup.close()
      }
      setDiscordLoading(false)
      setDiscordError('Discord authentication timed out. Please try again.')
    }, DISCORD_POPUP_TIMEOUT)

    // Check if popup was closed manually
    // Using a longer interval to reduce false positives from race conditions
    discordPopupIntervalRef.current = setInterval(() => {
      if (popup.closed) {
        clearDiscordTimers()
        // Wait for postMessage handler to complete before checking auth status
        setTimeout(() => {
          // Check if auth completed via postMessage (loading would be false)
          setDiscordLoading(prev => {
            if (prev) {
              // Still loading means auth didn't complete - show cancellation error
              setDiscordError('Discord authentication was cancelled. Please try again.')
              return false
            }
            return prev
          })
        }, DISCORD_POSTMESSAGE_DELAY)
      }
    }, DISCORD_POPUP_CHECK_INTERVAL)
  }

  const handleDiscordLogout = () => {
    // Clear any active timers from Discord popup
    clearDiscordTimers()

    // Disconnect wallet first if connected
    if (isConnected) {
      disconnect()
    }
    
    // Clear Discord state
    setDiscordUser(null)
    setGuildMember(null)
    setHighestRole(null)
    setDiscordError(null)
    setDiscordLoading(false)
    setIsAdmin(false)
    
    // Clear Discord auth from session storage
    sessionStorage.removeItem('discord_auth')
    
    // Reset mint status
    setAlreadyMinted(false)
    setHasLowerTierAvailable(false)
  }

  return (
    <>
      <Head>
        <title>Botanix Ambassador Program</title>
        <meta name="description" content="Botanix Ambassador Program" />
      </Head>
      <main style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        {/* Branding header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <p style={{ fontFamily: "'Courier New', monospace", fontSize: '1.5rem', fontWeight: 900, color: '#ffd966', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
            Botanix • Ambassador Program
          </p>
          <p style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", fontSize: '0.95rem', color: '#bbb', marginTop: '8px', fontWeight: 400 }}>
            Immutable proof of your contributions. Mint your achievements monthly.
          </p>
        </div>

        {/* 3-column bento grid */}
        <div className="main-container">

          {/* ── CARD 1 — STEP 01 // INPUTS — Link Sources ── */}
          <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <p className="step-indicator">STEP 01 // INPUTS</p>
              <h2 style={{ margin: '4px 0 0', fontSize: '1.25rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Link Sources</h2>
            </div>

            {/* Discord connect module */}
            <div className={`connect-module${isDiscordVerified ? ' connected' : ''}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span className="status-indicator"></span>
                <span className="data-point" style={{ fontWeight: 'bold', color: isDiscordVerified ? '#ffd966' : '#bbb' }}>
                  {isDiscordVerified ? 'DISCORD CONNECTED' : 'DISCORD DISCONNECTED'}
                </span>
              </div>
              {isDiscordVerified && discordUser && (
                <p className="data-point" style={{ marginBottom: '10px' }}>
                  User: <span className="data-highlight">{discordUser.global_name || discordUser.username}</span>
                </p>
              )}
              {!isDiscordVerified ? (
                <button onClick={openDiscordPopup} disabled={discordLoading} className="mint-button" style={{ fontSize: '0.85rem', padding: '12px' }}>
                  {discordLoading ? 'WAITING FOR DISCORD…' : 'CONNECT DISCORD'}
                </button>
              ) : (
                <button onClick={handleDiscordLogout} className="logout-button">
                  LOGOUT
                </button>
              )}
            </div>

            {/* Wallet connect module */}
            <div className={`connect-module${isConnected ? ' connected' : ''}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span className="status-indicator"></span>
                <span className="data-point" style={{ fontWeight: 'bold', color: isConnected ? '#ffd966' : '#bbb' }}>
                  {!isDiscordVerified ? 'WEB3 LOCKED' : isConnected ? 'WEB3 LIVE' : 'WEB3 DISCONNECTED'}
                </span>
              </div>
              {isConnected && address && (
                <p className="data-point" style={{ marginBottom: '10px' }}>
                  Addr: <span className="data-highlight">{address.slice(0, 6)}…{address.slice(-4)}</span>
                </p>
              )}
              {isDiscordVerified && !isConnected && (
                <div style={{ opacity: 1 }}>
                  <ConnectButton.Custom>
                    {({ openConnectModal }) => (
                      <button onClick={openConnectModal} className="mint-button" style={{ fontSize: '0.85rem', padding: '12px' }}>
                        CONNECT WALLET
                      </button>
                    )}
                  </ConnectButton.Custom>
                </div>
              )}
              {isConnected && (
                <div>
                  <ConnectButton label="CONNECTED" showBalance={false} chainStatus="none" />
                </div>
              )}
            </div>

            {/* Admin Dashboard button */}
            {isAdmin && (
              <button onClick={() => router.push('/admin/dashboard')} className="mint-button" style={{ fontSize: '0.85rem', padding: '12px' }}>
                ADMIN DASHBOARD
              </button>
            )}

            {discordError && <p style={{ color: '#ff3366', fontFamily: "'Courier New', monospace", fontSize: '0.8rem', margin: 0 }}>{discordError}</p>}
          </div>

          {/* ── CARD 2 — STEP 02 // ANALYSIS — Performance Data ── */}
          <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <p className="step-indicator">STEP 02 // ANALYSIS</p>
              <h2 style={{ margin: '4px 0 0', fontSize: '1.25rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Performance Data</h2>
            </div>

            {/* BOTANIX DISCORD MEMBERSHIP */}
            <div>
              <p className="data-point" style={{ marginBottom: '4px' }}>BOTANIX DISCORD MEMBERSHIP:</p>
              {!isDiscordVerified ? (
                <span className="data-highlight" style={{ color: '#bbb', borderBottomColor: '#bbb' }}>NOT CONNECTED</span>
              ) : guildMember ? (
                <span className="data-highlight">CONFIRMED</span>
              ) : (
                <a
                  href="https://discord.gg/2D95PBCM2g"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="data-highlight"
                  style={{ textDecoration: 'none' }}
                >
                  CLICK TO JOIN
                </a>
              )}
            </div>

            {/* AMBASSADOR LEVEL */}
            <div>
              <p className="data-point" style={{ marginBottom: '4px' }}>AMBASSADOR LEVEL:</p>
              <span className={highestRole ? 'data-highlight' : ''} style={!highestRole ? { fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: '#bbb' } : {}}>
                {highestRole ? highestRole.name.toUpperCase() : 'NOT CONNECTED'}
              </span>
            </div>

            {/* TENURE */}
            <div>
              <p className="data-point" style={{ marginBottom: '4px' }}>TENURE:</p>
              <span className={guildMember && tenureDays !== null ? 'data-highlight' : ''} style={!(guildMember && tenureDays !== null) ? { fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: '#bbb' } : {}}>
                {guildMember && tenureDays !== null ? `${tenureDays} DAYS` : 'NOT CONNECTED'}
              </span>
            </div>

            {/* STATUS */}
            <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              {isDiscordVerified && isConnected ? (
                <p className="data-point">STATUS: <span style={{ color: '#fff366', fontWeight: 'bold' }}>CONNECTED_</span></p>
              ) : (
                <p className="data-point">STATUS: <span style={{ color: '#bbb', fontWeight: 'bold' }}>AWAITING INPUTS_</span></p>
              )}
            </div>
          </div>

          {/* ── CARD 3 — STEP 03 // EXECUTE — Push to Chain ── */}
          <div className="bento-card" style={{ borderColor: '#ffd966', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <p className="step-indicator">STEP 03 // EXECUTE</p>
              <h2 style={{ margin: '4px 0 0', fontSize: '1.25rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Push to Chain</h2>
            </div>

            {/* NFT Preview */}
            <div className="nft-preview-placeholder">
              {isLoadingMedia ? (
                <span style={{ fontSize: '0.9rem', letterSpacing: '0.05em' }}>LOADING MEDIA...</span>
              ) : mediaGatewayURL ? (
                <img
                  src={mediaGatewayURL}
                  alt="NFT Preview"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(255,217,102,0.3))' }}
                  onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE }}
                />
              ) : (
                <span style={{ fontSize: '0.9rem', letterSpacing: '0.05em' }}>CONNECT TO PREVIEW</span>
              )}
            </div>

            {/* Data rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p className="data-point">
                TIER: <span className="data-highlight">{tierNumber !== null ? String(tierNumber) : 'N/A'}</span>
              </p>
              <p className="data-point">
                PERIOD: <span className="data-highlight">
                  {currentMonth ? `${currentMonth.monthName.toUpperCase()} ${currentMonth.year}` : 'LOADING...'}
                </span>
              </p>
              <p className="data-point">
                STATUS: <span className="data-highlight">
                  {alreadyMinted && hasLowerTierAvailable
                    ? 'PARTIAL // LOWER_TIER_AVAILABLE'
                    : alreadyMinted
                    ? 'EXECUTED // AWAITING_NEXT_PERIOD'
                    : canProceedToMint
                    ? 'AVAILABLE'
                    : 'PENDING'}
                </span>
              </p>
            </div>

            {/* Single mint button — switches between primary mint and lower-tier batch */}
            <button
              onClick={() => {
                setMintLoading(true)
                if (alreadyMinted && unmintedLowerTiers.length > 0) {
                  sbtMinterRef.current?.triggerBatchMint()
                } else {
                  sbtMinterRef.current?.triggerMint()
                }
              }}
              disabled={(alreadyMinted && unmintedLowerTiers.length === 0) || (!canProceedToMint && !alreadyMinted && unmintedLowerTiers.length === 0) || mintLoading}
              className="mint-button"
            >
              {mintLoading
                ? 'MINTING...'
                : alreadyMinted && unmintedLowerTiers.length > 0
                  ? `MINT ${unmintedLowerTiers.length} LOWER TIER${unmintedLowerTiers.length > 1 ? 'S' : ''}`
                  : 'EXECUTE FREEMINT'}
            </button>

            {/* Inline feedback */}
            {mintError && <p style={{ color: '#ff4444', fontFamily: "'Courier New', monospace", fontSize: '0.85rem', marginTop: '8px' }}>{mintError}</p>}
          </div>
        </div>

        {/* Headless SBTMinter — runs mint logic, no UI */}
        {highestRole && discordUser && (
          <SBTMinter
            ref={sbtMinterRef}
            discordId={discordUser.id}
            roleName={highestRole.name}
            sectionNumber={0}
            alreadyMinted={alreadyMinted}
            hasLowerTierAvailable={hasLowerTierAvailable}
            hideUI
            onError={setMintError}
            onSuccess={setMintSuccess}
            onLoadingChange={setMintLoading}
            onUnmintedLowerTiersChange={setUnmintedLowerTiers}
            onMintStatusChange={setAlreadyMinted}
          />
        )}
      </main>
    </>
  )
}

