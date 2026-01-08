import { useEffect, useMemo, useState, useRef } from 'react'
import Head from 'next/head'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useDisconnect } from 'wagmi'
import { SBTMinter } from '@/components/SBTMinter'
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

export default function Home() {
  const [discordUser, setDiscordUser] = useState<DiscordUser | null>(null)
  const [guildMember, setGuildMember] = useState<GuildMember | null>(null)
  const [highestRole, setHighestRole] = useState<{ id: string; name: RoleName } | null>(null)
  const [discordLoading, setDiscordLoading] = useState(false)
  const [discordError, setDiscordError] = useState<string | null>(null)
  const [showPopup, setShowPopup] = useState(false)
  const [alreadyMinted, setAlreadyMinted] = useState(false)
  const [hasLowerTierAvailable, setHasLowerTierAvailable] = useState(false)
  const [checkingMintStatus, setCheckingMintStatus] = useState(false)

  const isDiscordVerified = useMemo(() => Boolean(discordUser && guildMember), [discordUser, guildMember])

  // Wallet connection tracking
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const lastLoggedAddress = useRef<string | undefined>(undefined)
  const hasShownPopup = useRef(false)
  
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

  // Check mint status when wallet connects and Discord is verified
  useEffect(() => {
    if (isConnected && isDiscordVerified && discordUser && highestRole && !hasShownPopup.current) {
      setCheckingMintStatus(true)
      fetch('/api/nft/check-mint-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordId: discordUser.id,
          roleName: highestRole.name,
        }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setAlreadyMinted(data.alreadyMinted)
            setHasLowerTierAvailable(data.hasLowerTierAvailable)
          }
          setShowPopup(true)
          hasShownPopup.current = true
        })
        .catch(err => {
          console.error('Failed to check mint status:', err)
          // Show popup anyway on error
          setShowPopup(true)
          hasShownPopup.current = true
        })
        .finally(() => {
          setCheckingMintStatus(false)
        })
    }
  }, [isConnected, isDiscordVerified, discordUser, highestRole])

  // Clear any persisted Discord state on mount to ensure fresh authentication
  // Users must re-authenticate with Discord after page refresh/restart
  useEffect(() => {
    // Clear any stored Discord authentication data
    localStorage.removeItem('discord_user')
    localStorage.removeItem('discord_member')
    localStorage.removeItem('discord_role')
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
      } else {
        setDiscordError(event.data.error || 'Не удалось авторизоваться через Discord')
        setDiscordUser(null)
        setGuildMember(null)
        setHighestRole(null)
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

    // Set timeout to reset loading state after 60 seconds
    discordPopupTimeoutRef.current = setTimeout(() => {
      clearDiscordTimers()
      if (popup && !popup.closed) {
        popup.close()
      }
      setDiscordLoading(false)
      setDiscordError('Discord authentication timed out. Please try again.')
    }, 60000)

    // Check if popup was closed manually
    // Using a longer interval (2 seconds) to reduce false positives
    discordPopupIntervalRef.current = setInterval(() => {
      if (popup.closed) {
        clearDiscordTimers()
        // Wait 500ms to ensure postMessage handler has time to complete
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
        }, 500)
      }
    }, 2000)
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
    
    // Clear any persisted state
    localStorage.removeItem('discord_user')
    localStorage.removeItem('discord_member')
    localStorage.removeItem('discord_role')
    
    // Reset popup and mint status
    hasShownPopup.current = false
    setShowPopup(false)
    setAlreadyMinted(false)
    setHasLowerTierAvailable(false)
  }

  return (
    <>
      <Head>
        <title>Botanix Ambassador Program</title>
        <meta name="description" content="Botanix Ambassador Program" />
      </Head>
      <main className="min-h-screen bg-background py-12 px-4 flex justify-center">
        <section className="w-full max-w-4xl card-cyber p-8 space-y-8">
          <div className="flex items-start justify-between gap-4 flex-wrap pb-6">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-accent mb-2">Botanix • Ambassador Program</p>
              <p className="text-text-secondary">Verify Discord and connect wallet to mint your SBT</p>
            </div>
          </div>
          
          <div className="divider-cyber"></div>

          <div className="card-cyber p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold font-proxima text-text-primary uppercase">Step 1: Authorise using your Discord account</h2>
            </div>
            
            <div className="flex gap-5 flex-wrap">
              <div className="flex-1 min-w-[300px]">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="text-lg font-bold font-proxima text-text-primary uppercase">Discord check</h3>
                  <span className={`badge-cyber ${isDiscordVerified ? 'text-accent' : 'text-text-secondary'}`}>
                    {isDiscordVerified ? 'Ready' : 'Required'}
                  </span>
                </div>
                <p className="text-text-secondary mb-4">Sign in with Discord to confirm Botanix server membership.</p>

                <div className="flex gap-3">
                  <button 
                    onClick={openDiscordPopup} 
                    disabled={discordLoading} 
                    className="btn-cyber flex-1"
                  >
                    {discordLoading ? 'Waiting for Discord…' : isDiscordVerified ? 'Re-check' : 'Sign in with Discord'}
                  </button>
                  {isDiscordVerified && (
                    <button onClick={handleDiscordLogout} className="btn-cyber-secondary">
                      Logout
                    </button>
                  )}
                </div>

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

          <div className="card-cyber p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold font-proxima text-text-primary uppercase">Step 2: Connect your wallet</h2>
            </div>
            
            <div className="flex gap-5 flex-wrap">
              <div className="flex-1 min-w-[300px]">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="text-lg font-bold font-proxima text-text-primary uppercase">Connect wallet</h3>
                  <span className={`badge-cyber ${isDiscordVerified ? 'text-accent' : 'text-text-secondary'}`}>
                    {isDiscordVerified ? 'Available' : 'Locked'}
                  </span>
                </div>
                <p className="text-text-secondary mb-4">
                  After Discord verification, connect your EVM wallet via WalletConnect. Network: {chainConfig.name} (id {chainConfig.id}).
                </p>
                <div className={isDiscordVerified ? '' : 'opacity-40 pointer-events-none'}>
                  <ConnectButton label="Connect wallet" showBalance={false} chainStatus="name" />
                </div>
                {!isDiscordVerified && <p className="mt-2 text-text-secondary text-sm">Finish Discord login first.</p>}
              </div>
            </div>
          </div>
        </section>

        {/* Popup Modal */}
        {showPopup && isConnected && isDiscordVerified && highestRole && (
          <>
            <div className="fixed inset-0 bg-background bg-opacity-90 z-[999]" onClick={() => setShowPopup(false)} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] w-full max-w-2xl max-h-[90vh] px-4">
              <div className="card-cyber p-8 relative">
                <button 
                  className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-surface font-bold text-2xl transition-all duration-200 text-accent hover:text-accent-neon border-2 border-accent hover:border-accent-neon" 
                  onClick={() => setShowPopup(false)}
                  style={{clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))'}}
                >
                  ×
                </button>
                <h2 className="text-3xl font-bold font-proxima text-text-primary text-center mb-2 uppercase">Your Ambassador Level</h2>
                <p className="text-4xl font-bold font-proxima text-accent text-center mb-6" style={{textShadow: 'var(--glow-yellow)'}}>{highestRole.name}</p>
                <div className="divider-cyber mb-6" />
                {discordUser && (
                  <SBTMinter 
                    discordId={discordUser.id} 
                    roleName={highestRole.name} 
                    sectionNumber={0}
                    alreadyMinted={alreadyMinted}
                    hasLowerTierAvailable={hasLowerTierAvailable}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </>
  )
}


