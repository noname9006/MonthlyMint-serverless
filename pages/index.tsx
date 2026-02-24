import { useEffect, useMemo, useState, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useDisconnect } from 'wagmi'
import { SBTMinter } from '@/components/SBTMinter'
import { MintModal } from '@/components/MintModal'
import { chainConfig } from '@/lib/chains'

import type { RoleName } from '@/lib/discord'

type DiscordUser = {
  id: string
  username: string
  global_name?: string
  avatar?: string | null
}

type GuildMember = {
  roles?: string[]
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
  const [showMintModal, setShowMintModal] = useState(false)

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

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null

  return (
    <>
      <Head>
        <title>Botanix Ambassador Program</title>
        <meta name="description" content="Botanix Ambassador Program" />
      </Head>
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', padding: '40px 20px' }}>
        {/* Header */}
        <div style={{ maxWidth: 1100, margin: '0 auto 32px' }}>
          <p style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '0.75rem', fontWeight: 700, color: 'var(--yellow-dark)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>
            Botanix • Ambassador Program
          </p>
          <p style={{ color: '#888', fontSize: '0.9rem' }}>
            Immutable proof of your contributions. Mint your achievements monthly.
          </p>
        </div>

        {/* 3-column bento grid */}
        <div className="bento-grid" style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 24,
        }}>
          <style>{`
            @media (max-width: 900px) {
              .bento-grid { grid-template-columns: 1fr !important; }
            }
          `}</style>

          {/* ── Card 1: STEP 01 // INPUTS ── */}
          <div className="card-cyber" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <p className="step-indicator">STEP 01 // INPUTS</p>
              <h2 style={{ fontFamily: 'var(--font-proxima)', fontWeight: 700, fontSize: '1.1rem', color: '#fff', textTransform: 'uppercase', marginTop: 6, marginBottom: 0 }}>
                Link Sources
              </h2>
            </div>

            {/* Discord connect module */}
            <div className={`connect-module${isDiscordVerified ? ' connected' : ''}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span className={`status-dot${isDiscordVerified ? ' connected' : ''}`}></span>
                <span className="data-point">{isDiscordVerified ? 'DISCORD CONNECTED' : 'DISCORD REQUIRED'}</span>
              </div>
              {discordUser && (
                <p className="data-highlight" style={{ fontSize: '0.9rem', marginBottom: 10 }}>
                  {discordUser.global_name || discordUser.username}
                </p>
              )}
              {!isDiscordVerified ? (
                <button onClick={openDiscordPopup} disabled={discordLoading} className="btn-cyber" style={{ width: '100%' }}>
                  {discordLoading ? 'WAITING…' : 'SIGN IN WITH DISCORD'}
                </button>
              ) : (
                <button onClick={handleDiscordLogout} className="btn-cyber-secondary" style={{ width: '100%' }}>
                  DISCONNECT
                </button>
              )}
            </div>

            {/* Wallet connect module */}
            <div className={`connect-module${isConnected ? ' connected' : ''}${!isDiscordVerified ? ' opacity-40 pointer-events-none' : ''}`}
              style={{ opacity: isDiscordVerified ? undefined : 0.4, pointerEvents: isDiscordVerified ? undefined : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span className={`status-dot${isConnected ? ' connected' : ''}`}></span>
                <span className="data-point">{isConnected ? 'WEB3 CONNECTED' : 'WALLET REQUIRED'}</span>
              </div>
              {isConnected && shortAddress && (
                <p className="data-highlight" style={{ fontSize: '0.9rem', marginBottom: 10 }}>
                  {shortAddress}
                </p>
              )}
              <ConnectButton label="CONNECT WALLET" showBalance={false} chainStatus="none" />
            </div>

            {/* Admin dashboard button */}
            {isAdmin && (
              <button onClick={() => router.push('/admin/dashboard')} className="btn-cyber" style={{ width: '100%' }}>
                ADMIN DASHBOARD
              </button>
            )}

            {/* Discord error */}
            {discordError && (
              <p style={{ color: 'var(--color-error)', fontFamily: '"Courier New", Courier, monospace', fontSize: '0.75rem', marginTop: 4 }}>
                {discordError}
              </p>
            )}
          </div>

          {/* ── Card 2: STEP 02 // ANALYSIS ── */}
          <div className="card-cyber" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <p className="step-indicator">STEP 02 // ANALYSIS</p>
              <h2 style={{ fontFamily: 'var(--font-proxima)', fontWeight: 700, fontSize: '1.1rem', color: '#fff', textTransform: 'uppercase', marginTop: 6, marginBottom: 0 }}>
                Eligibility Check
              </h2>
            </div>

            {/* Role display */}
            <div>
              <p className="data-point" style={{ marginBottom: 6 }}>DISCORD ROLE DETECTED:</p>
              <p style={{
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '1.4rem',
                fontWeight: 700,
                color: highestRole ? 'var(--yellow-dark)' : '#555',
                letterSpacing: '0.04em',
                lineHeight: 1.2,
              }}>
                {highestRole
                  ? highestRole.name.toUpperCase()
                  : isDiscordVerified
                    ? 'NO ELIGIBLE ROLE FOUND'
                    : 'AWAITING AUTH_'}
              </p>
            </div>

            {/* Data points */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p className="data-point">
                WALLET:{' '}
                <span style={{ color: isConnected ? '#ccc' : '#555' }}>
                  {shortAddress || 'NOT CONNECTED'}
                </span>
              </p>
              <p className="data-point">
                GUILD MEMBERSHIP:{' '}
                <span style={{ color: guildMember ? 'var(--yellow-dark)' : '#555' }}>
                  {guildMember ? 'VERIFIED' : 'UNVERIFIED'}
                </span>
              </p>
            </div>

            {/* Already minted indicator */}
            {alreadyMinted && (
              <p style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '0.72rem', color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                THIS MONTH: ALREADY MINTED ✓
              </p>
            )}

            {/* Lower tier available indicator */}
            {hasLowerTierAvailable && (
              <p style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '0.72rem', color: 'var(--yellow-dark)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                LOWER TIERS: AVAILABLE
              </p>
            )}

            {/* No role - join discord link */}
            {isDiscordVerified && !highestRole && (
              <p style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: '0.75rem', color: '#888' }}>
                <a href="https://discord.gg/2D95PBCM2g" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--yellow-dark)', textDecoration: 'underline' }}>
                  JOIN BOTANIX DISCORD
                </a>{' '}to become eligible.
              </p>
            )}

            {/* Status banner */}
            <div style={{ borderTop: '1px solid var(--border-grey)', paddingTop: 12, marginTop: 'auto' }}>
              <p style={{
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '0.8rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: canProceedToMint ? 'var(--yellow-dark)' : '#555',
              }}>
                {canProceedToMint
                  ? 'STATUS: MINT ELIGIBLE_'
                  : !isDiscordVerified
                    ? 'STATUS: PREREQUISITES PENDING_'
                    : !highestRole
                      ? 'STATUS: ROLE REQUIRED_'
                      : 'STATUS: PREREQUISITES PENDING_'}
              </p>
            </div>
          </div>

          {/* ── Card 3: STEP 03 // EXECUTE ── */}
          <div
            className="card-cyber"
            style={{
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              borderColor: canProceedToMint ? 'var(--yellow-dark)' : undefined,
              boxShadow: canProceedToMint ? '0 0 35px rgba(255,217,102,0.15)' : undefined,
            }}
          >
            <div>
              <p className="step-indicator">STEP 03 // EXECUTE</p>
              <h2 style={{ fontFamily: 'var(--font-proxima)', fontWeight: 700, fontSize: '1.1rem', color: '#fff', textTransform: 'uppercase', marginTop: 6, marginBottom: 0 }}>
                Mint Artifact
              </h2>
            </div>

            {/* NFT preview */}
            <div className="nft-preview card-cyber" style={{ minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {highestRole ? (
                <p style={{ fontFamily: '"Courier New", Courier, monospace', color: 'var(--yellow-dark)', fontWeight: 700, fontSize: '0.85rem', textAlign: 'center', letterSpacing: '0.06em' }}>
                  [ {highestRole.name.toUpperCase()} NFT PREVIEW ]
                </p>
              ) : (
                <p style={{ fontFamily: '"Courier New", Courier, monospace', color: '#555', fontSize: '0.85rem', textAlign: 'center' }}>
                  [ AWAITING ROLE ]
                </p>
              )}
            </div>

            {/* Data points */}
            {highestRole && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <p className="data-point">TIER: <span style={{ color: '#ccc' }}>{highestRole.name.toUpperCase()}</span></p>
                <p className="data-point">NETWORK: <span style={{ color: '#ccc' }}>BOTANIX MAINNET</span></p>
                <p className="data-point">GAS: <span style={{ color: 'var(--yellow-dark)' }}>FREEMINT</span></p>
              </div>
            )}

            {/* Mint button */}
            <div style={{ marginTop: 'auto' }}>
              {alreadyMinted ? (
                <button className="btn-cyber" disabled style={{ width: '100%' }}>
                  MINTED THIS MONTH
                </button>
              ) : canProceedToMint ? (
                <button className="btn-cyber" onClick={() => setShowMintModal(true)} style={{ width: '100%' }}>
                  INITIALIZE MINT
                </button>
              ) : (
                <button className="btn-cyber" disabled style={{ width: '100%' }}>
                  LOCKED
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mint Modal */}
        {highestRole && discordUser && (
          <MintModal isOpen={showMintModal} onClose={() => setShowMintModal(false)}>
            <div style={{ marginBottom: 24 }}>
              <p className="step-indicator" style={{ textAlign: 'center', marginBottom: 8 }}>STEP 03 // EXECUTE</p>
              <h2 style={{ fontFamily: 'var(--font-proxima)', fontWeight: 700, fontSize: '1.6rem', color: '#fff', textTransform: 'uppercase', textAlign: 'center', marginBottom: 6 }}>
                Mint Your Artifact
              </h2>
              <p style={{ textAlign: 'center', fontFamily: '"Courier New", Courier, monospace', fontSize: '0.8rem', color: 'var(--yellow-dark)' }}>
                TIER: {highestRole.name.toUpperCase()}
              </p>
            </div>
            <SBTMinter
              discordId={discordUser.id}
              roleName={highestRole.name}
              sectionNumber={0}
              alreadyMinted={alreadyMinted}
              hasLowerTierAvailable={hasLowerTierAvailable}
            />
          </MintModal>
        )}
      </div>
    </>
  )
}


