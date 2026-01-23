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

  const avatarUrl =
    discordUser && discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`
      : null

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
      <main className="min-h-screen bg-background py-6 sm:py-12 px-2 sm:px-4 flex justify-center">
        <section className="w-full max-w-4xl card-cyber p-4 sm:p-8 space-y-6 sm:space-y-8">
          <div className="flex items-start justify-between gap-4 flex-wrap pb-4 sm:pb-6">
            <div>
              <p className="text-xs sm:text-sm font-bold uppercase tracking-widest text-accent mb-2">Botanix • Ambassador Program</p>
              <p className="text-sm sm:text-base text-text-secondary">Immutable proof of your contributions. Mint your achievements monthly.</p>
            </div>
          </div>
          
          <div className="divider-cyber"></div>

          <div className="card-cyber p-4 sm:p-6">
            <div className="mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold font-proxima text-text-primary uppercase">Step 1: Authorise using your Discord account</h2>
            </div>
            
            <div className="flex gap-5 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="text-base sm:text-lg font-bold font-proxima text-text-primary uppercase">Discord check</h3>
                  <span className={`badge-cyber ${isDiscordVerified ? 'text-accent' : 'text-text-secondary'}`}>
                    {isDiscordVerified ? 'Ready' : 'Required'}
                  </span>
                </div>


                <div className="flex gap-3">
                  {!isDiscordVerified && (
                    <button 
                      onClick={openDiscordPopup} 
                      disabled={discordLoading} 
                      className="btn-cyber flex-1"
                    >
                      {discordLoading ? 'Waiting for Discord…' : 'Sign in with Discord'}
                    </button>
                  )}
                  {isDiscordVerified && (
                    <button onClick={handleDiscordLogout} className="btn-cyber-secondary flex-1">
                      Logout
                    </button>
                  )}
                </div>

                {/* Admin Dashboard Button */}
                {isAdmin && (
                  <div className="mt-3">
                    <button 
                      onClick={() => router.push('/admin/dashboard')} 
                      className="btn-cyber w-full"
                    >
                      Admin Dashboard
                    </button>
                  </div>
                )}

                {discordError && <p className="text-error mt-3 text-sm">{discordError}</p>}

                {discordUser && (
                  <div className="mt-4 card-cyber p-4">
                    <div className="flex flex-col items-center gap-3 p-2">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="avatar" className="w-18 h-18 rounded-full border-2 border-accent" style={{boxShadow: 'var(--glow-yellow)'}} />
                      ) : (
                        <span className="w-18 h-18 rounded-full bg-accent text-text-inverse flex items-center justify-center font-bold text-3xl uppercase border-2 border-accent" style={{boxShadow: 'var(--glow-yellow)'}}>
                          {(discordUser.global_name || discordUser.username || '?')[0]}
                        </span>
                      )}
                      <span className="text-lg font-bold text-text-primary uppercase tracking-wide">
                        {discordUser.global_name || discordUser.username}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="divider-cyber"></div>

          <div className="card-cyber p-4 sm:p-6">
            <div className="mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold font-proxima text-text-primary uppercase">Step 2: Connect your wallet</h2>
            </div>
            
            <div className="flex gap-5 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="text-base sm:text-lg font-bold font-proxima text-text-primary uppercase">Connect wallet</h3>
                  <span className={`badge-cyber ${isDiscordVerified ? 'text-accent' : 'text-text-secondary'}`}>
                    {isDiscordVerified ? 'Available' : 'Locked'}
                  </span>
                </div>
                <div className={isDiscordVerified ? '' : 'opacity-40 pointer-events-none'}>
                  <ConnectButton label="Connect wallet" showBalance={false} chainStatus="name" />
                </div>

              </div>
            </div>
          </div>

          {/* Mint Section - shown when wallet and discord are connected */}
          {isDiscordVerified && isConnected && (
            <div className="mt-6 sm:mt-8">
              <div className="divider-cyber mb-6 sm:mb-8"></div>
              <div className="card-cyber p-4 sm:p-6">
                <div className="mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold font-proxima text-text-primary uppercase">Step 3: Mint your NFT</h2>
                </div>
                
                <div className="flex gap-5 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h3 className="text-base sm:text-lg font-bold font-proxima text-text-primary uppercase">Ready to mint</h3>
                      <span className={`badge-cyber ${canProceedToMint ? 'text-accent' : 'text-text-secondary'}`}>
                        {canProceedToMint ? 'Ready' : 'Checking...'}
                      </span>
                    </div>
                    
                    {highestRole ? (
                      <>
                        <p className="text-sm sm:text-base text-text-secondary mb-4">
                          Your level: <span className="text-accent font-bold">{highestRole.name}</span>
                        </p>
                        <button
                          onClick={() => setShowMintModal(true)}
                          disabled={!canProceedToMint}
                          className="btn-cyber w-full"
                        >
                          Proceed to Mint
                        </button>
                      </>
                    ) : (
                      <p className="text-sm sm:text-base text-text-secondary mb-4">
                        <a href="https://discord.gg/2D95PBCM2g" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                          Join Botanix Discord
                        </a> today to be eligible.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Mint Modal */}
          {highestRole && discordUser && (
            <MintModal isOpen={showMintModal} onClose={() => setShowMintModal(false)}>
              <div className="mb-4 sm:mb-6">
                <h2 className="text-2xl sm:text-3xl font-bold font-proxima text-text-primary uppercase text-center">Mint Your NFT</h2>
                <p className="text-center text-sm sm:text-base text-text-secondary mt-2">Level: <span className="text-accent font-bold">{highestRole.name}</span></p>
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
        </section>
      </main>
    </>
  )
}


