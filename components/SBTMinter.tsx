import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useConfig } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { SBT_ABI } from '@/lib/sbt-abi'
import { chainConfig } from '@/lib/chains'
import { getMediaURI, ipfsToGateway } from '@/lib/media-config'

// Single NFT contract address for all roles
const NFT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || ''

interface SBTMinterProps {
  discordId: string
  roleName: string
  sectionNumber?: number
  alreadyMinted?: boolean
  hasLowerTierAvailable?: boolean
}

// Fallback image for when IPFS media fails to load
const FALLBACK_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect width="200" height="200" fill="%23334155"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="14"%3EImage not available%3C/text%3E%3C/svg%3E'

interface UnmintedLowerTier {
  id: string
  name: string
  priority: number
}

export function SBTMinter({ discordId, roleName, sectionNumber = 3, alreadyMinted = false, hasLowerTierAvailable = false }: SBTMinterProps) {
  const { address } = useAccount()
  const config = useConfig()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  // Track which transactions are currently being logged to prevent duplicate requests
  const [loggingInProgress, setLoggingInProgress] = useState<Set<string>>(new Set())
  
  // Track local minted state (for when user mints in current session)
  const [localMinted, setLocalMinted] = useState(false)
  
  // Lower tier minting state
  const [unmintedLowerTiers, setUnmintedLowerTiers] = useState<UnmintedLowerTier[]>([])
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null)
  
  // Current month/year state
  const [currentMonth, setCurrentMonth] = useState<{ monthName: string; year: number } | null>(null)
  const [isLoadingMonth, setIsLoadingMonth] = useState(true)
  
  // Media URI state - fetch from database
  const [mediaURI, setMediaURI] = useState<string | null>(null)
  const [isLoadingMedia, setIsLoadingMedia] = useState(false)
  
  // Combine prop and local state to determine if minted
  const isMinted = alreadyMinted || localMinted
  
  // Default values for removed fields
  const metadata = 'student'
  const credentialType = 'Education'
  const issuerName = 'Botanix'

  // Check if rendering in main page or modal context
  const isMainPage = sectionNumber > 0

  // Check if contract address is configured
  if (!NFT_CONTRACT_ADDRESS) {
    return (
      <div className={isMainPage ? 'card-cyber p-6 mt-8' : ''}>
        {isMainPage && (
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-2xl font-bold font-proxima text-text-primary uppercase">{sectionNumber}. Mint your NFT</h2>
            <span className="badge-cyber text-text-secondary">Not Configured</span>
          </div>
        )}
        <p className="text-error text-sm">
          NFT contract is not configured. Please set NEXT_PUBLIC_NFT_CONTRACT_ADDRESS in your environment variables.
        </p>
      </div>
    )
  }

  const { writeContractAsync: mintWithSignatureAsync, reset: resetWriteContract } = useWriteContract()

  // Fetch current month on component mount
  useEffect(() => {
    fetchCurrentMonth()
  }, [])

  const fetchCurrentMonth = async () => {
    try {
      setIsLoadingMonth(true)
      const response = await fetch('/api/admin/set-current-month', {
        method: 'GET',
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.currentMonth) {
          setCurrentMonth(data.currentMonth)
        }
      }
    } catch (err) {
      console.error('Failed to fetch current month:', err)
    } finally {
      setIsLoadingMonth(false)
    }
  }

  // Fetch media from database when current month and role are available
  useEffect(() => {
    if (currentMonth && roleName) {
      fetchMediaFromDatabase(roleName, currentMonth.year, currentMonth.monthName)
    }
  }, [currentMonth, roleName])

  const fetchMediaFromDatabase = async (level: string, year: number, month: string) => {
    try {
      setIsLoadingMedia(true)
      const response = await fetch('/api/nft/get-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          levelName: level,
          year: year,
          monthName: month,
        }),
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.ipfsCid) {
          // Convert CID to ipfs:// URI
          const ipfsUri = cidToIpfsUri(data.ipfsCid)
          setMediaURI(ipfsUri)
        } else {
          // Try fallback to environment variables
          const envMediaURI = getMediaURI(level, year, month)
          setMediaURI(envMediaURI)
        }
      } else {
        // Fallback to environment variables
        const envMediaURI = getMediaURI(level, year, month)
        setMediaURI(envMediaURI)
      }
    } catch (err) {
      console.error('Failed to fetch media from database:', err)
      // Fallback to environment variables
      const envMediaURI = getMediaURI(level, year, month)
      setMediaURI(envMediaURI)
    } finally {
      setIsLoadingMedia(false)
    }
  }

  // Convert media URI to gateway URL for display
  const mediaGatewayURL = mediaURI ? ipfsToGateway(mediaURI) : null

  // Helper function to convert CID to ipfs:// URI
  const cidToIpfsUri = (cid: string): string => {
    if (!cid) return ''
    if (cid.startsWith('ipfs://')) return cid
    return `ipfs://${cid}`
  }

  // Helper function to wait for transaction and log the mint
  const waitForTransactionAndLog = async (txHash: `0x${string}`, tierName: string, tierMediaURI: string, tierMonthName: string, tierYear: number) => {
    // Check if this transaction is already being logged (deduplication)
    if (loggingInProgress.has(txHash)) {
      console.log(`Transaction ${txHash} is already being logged, skipping duplicate request`)
      return
    }

    // Mark this transaction as being logged immediately (before any async operations)
    setLoggingInProgress(prev => {
      const newSet = new Set(prev)
      newSet.add(txHash)
      return newSet
    })

    try {
      // Wait for the transaction to be confirmed
      await waitForTransactionReceipt(config, {
        hash: txHash,
      })

      // Call the log-mint API
      const response = await fetch('/api/nft/log-mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordId: discordId,
          walletAddress: address,
          contractAddress: NFT_CONTRACT_ADDRESS,
          transactionHash: txHash,
          roleName: tierName,
          credentialType: credentialType,
          metadata: metadata,
          mediaUri: tierMediaURI,
          levelName: tierName,
          monthName: tierMonthName,
          year: tierYear,
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        console.log('Mint event logged successfully:', data)
        // This was the main role mint - update local state
        setLocalMinted(true)
        setPendingTxHash(null)
        // Fetch unminted lower tiers to check if they exist
        fetchUnmintedLowerTiers().catch((err) => {
          console.error('Error fetching unminted lower tiers after mint:', err)
        })
        // Keep transaction in loggingInProgress on success to prevent duplicate logging attempts
      } else {
        console.error('Failed to log mint event:', data)
        // Even if logging fails, the mint succeeded on-chain
        setLocalMinted(true)
        setPendingTxHash(null)
        // Remove from loggingInProgress on API failure to allow retry
        setLoggingInProgress(prev => {
          const newSet = new Set(prev)
          newSet.delete(txHash)
          return newSet
        })
      }
    } catch (err) {
      console.error('Error waiting for transaction or logging mint event:', err)
      // Clear pending transaction hash for main role to allow retry
      setPendingTxHash(null)
      // Remove from loggingInProgress on error to allow retry
      setLoggingInProgress(prev => {
        const newSet = new Set(prev)
        newSet.delete(txHash)
        return newSet
      })
    }
  }

  // Fetch unminted lower tiers when component loads with hasLowerTierAvailable or after minting
  useEffect(() => {
    if (hasLowerTierAvailable && discordId) {
      fetchUnmintedLowerTiers()
    }
  }, [hasLowerTierAvailable, discordId])

  const handleMint = async () => {
    if (!address) {
      setError('Connect wallet first')
      return
    }

    if (!currentMonth) {
      setError('Current month not loaded')
      return
    }

    if (!mediaURI) {
      setError('Media URI not available for current month')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)
    resetWriteContract() // Reset previous transaction state
    
    try {
      // First, get the signature
      const response = await fetch('/api/nft/generate-mint-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userWalletAddress: address,
          metadata: metadata,
          mediaURI: mediaURI,
          credentialType: credentialType,
          issuerName: issuerName,
          discordId: discordId,
          roleName: roleName,
          contractAddress: NFT_CONTRACT_ADDRESS,
          levelName: roleName,
          monthName: currentMonth.monthName,
          year: currentMonth.year,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        
        // Handle specific error codes
        if (errorData.code === 'ALREADY_MINTED_TIER') {
          setError(`You have already minted this NFT for this month/year`)
        } else if (errorData.code === 'ALREADY_MINTED_ROLE') {
          setError(`You have already minted an NFT for the ${roleName} role`)
        } else if (errorData.code === 'ALREADY_MINTED_CONTRACT') {
          setError('You have already minted an NFT from this contract')
        } else if (errorData.code === 'MAX_MINTS_EXCEEDED') {
          setError('You have reached the maximum number of NFT mints')
        } else if (errorData.code === 'PENDING_MINT') {
          setError('You already have a pending mint for this role. Please wait...')
        } else {
          setError(`Error: ${errorData.error}`)
        }
        return
      }

      const data = await response.json()
      const signature = data.signature
      const nonce = data.nonce
      const requestId = data.requestId

      // Then, mint with the signature and capture the transaction hash
      const txHash = await mintWithSignatureAsync({
        address: NFT_CONTRACT_ADDRESS as `0x${string}`,
        abi: SBT_ABI,
        functionName: 'mintWithSignature',
        args: [
          address,
          metadata,
          mediaURI,
          credentialType,
          issuerName,
          BigInt(nonce),
          roleName,
          currentMonth.monthName,
          BigInt(currentMonth.year),
          requestId as `0x${string}`,
          signature as `0x${string}`,
        ],
      })
      
      // Store the pending transaction hash
      setPendingTxHash(txHash)
      
      // Wait for transaction and log it (don't await - let it run in background)
      waitForTransactionAndLog(txHash, roleName, mediaURI, currentMonth.monthName, currentMonth.year).catch((err) => {
        console.error('Unhandled error in waitForTransactionAndLog:', err)
      })
    } catch (err) {
      setError('Failed to mint NFT')
      console.error(err)
      setPendingTxHash(null)
    } finally {
      setLoading(false)
    }
  }

  // Fetch unminted lower tiers
  const fetchUnmintedLowerTiers = async () => {
    try {
      const response = await fetch('/api/nft/get-unminted-lower-tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordId: discordId,
          currentRoleName: roleName,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setUnmintedLowerTiers(data.unmintedLowerTiers)
        }
      }
    } catch (err) {
      console.error('Failed to fetch unminted lower tiers:', err)
    }
  }

  // Handle batch minting of all lower-tier NFTs
  const handleBatchMintLowerTiers = async () => {
    if (!address) {
      setError('Connect wallet first')
      return
    }

    if (!currentMonth) {
      setError('Current month not loaded')
      return
    }

    if (unmintedLowerTiers.length === 0) {
      setError('No lower tiers available to mint')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Prepare mint requests for all unminted lower tiers
      const mintRequests: Array<{
        metadata: string
        mediaURI: string
        credentialType: string
        issuerName: string
        roleName: string
        levelName: string
        monthName: string
        year: number
      }> = []
      
      for (const tier of unmintedLowerTiers) {
        // Fetch media URI for each tier
        const mediaResponse = await fetch('/api/nft/get-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            levelName: tier.name,
            year: currentMonth.year,
            monthName: currentMonth.monthName,
          }),
        })
        
        let tierMediaURI: string | null = null
        
        if (mediaResponse.ok) {
          const mediaData = await mediaResponse.json()
          if (mediaData.success && mediaData.ipfsCid) {
            tierMediaURI = cidToIpfsUri(mediaData.ipfsCid)
          }
        }
        
        // Fallback to environment variables if database fetch failed
        if (!tierMediaURI) {
          tierMediaURI = getMediaURI(tier.name, currentMonth.year, currentMonth.monthName)
        }
        
        if (!tierMediaURI) {
          setError(`Media not available for ${tier.name}`)
          setLoading(false)
          return
        }

        mintRequests.push({
          metadata: metadata,
          mediaURI: tierMediaURI,
          credentialType: credentialType,
          issuerName: issuerName,
          roleName: tier.name,
          levelName: tier.name,
          monthName: currentMonth.monthName,
          year: currentMonth.year,
        })
      }

      // Get batch signatures
      const response = await fetch('/api/nft/generate-batch-mint-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userWalletAddress: address,
          discordId: discordId,
          contractAddress: NFT_CONTRACT_ADDRESS,
          mintRequests: mintRequests,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(`Error: ${errorData.error}`)
        setLoading(false)
        return
      }

      const data = await response.json()
      
      // Validate response data
      if (!data.signatures || !Array.isArray(data.signatures) ||
          !data.requestIds || !Array.isArray(data.requestIds) ||
          !data.years || !Array.isArray(data.years) ||
          !data.metadatas || !Array.isArray(data.metadatas) ||
          !data.mediaURIs || !Array.isArray(data.mediaURIs) ||
          !data.credentialTypes || !Array.isArray(data.credentialTypes) ||
          !data.issuerNames || !Array.isArray(data.issuerNames) ||
          !data.levelNames || !Array.isArray(data.levelNames) ||
          !data.monthNames || !Array.isArray(data.monthNames)) {
        setError('Invalid response from batch mint signature API')
        setLoading(false)
        return
      }
      
      // Execute batch mint on-chain
      const txHash = await mintWithSignatureAsync({
        address: NFT_CONTRACT_ADDRESS as `0x${string}`,
        abi: SBT_ABI,
        functionName: 'mintBatchWithSignature',
        args: [
          {
            to: address,
            metadatas: data.metadatas,
            mediaURIs: data.mediaURIs,
            credentialTypes: data.credentialTypes,
            issuerNames: data.issuerNames,
            startNonce: BigInt(data.startNonce),
            levelNames: data.levelNames,
            monthNames: data.monthNames,
            yearValues: data.years.map((y: number) => BigInt(y)),
            requestIds: data.requestIds.map((id: string) => id as `0x${string}`),
            signatures: data.signatures.map((sig: string) => sig as `0x${string}`),
          }
        ],
      })

      // Wait for transaction confirmation
      await waitForTransactionReceipt(config, {
        hash: txHash,
      })

      // Log each mint individually using Promise.allSettled to attempt all logs
      const logPromises = mintRequests.map((request) => 
        fetch('/api/nft/log-mint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            discordId: discordId,
            walletAddress: address,
            contractAddress: NFT_CONTRACT_ADDRESS,
            transactionHash: txHash,
            roleName: request.levelName,
            credentialType: request.credentialType,
            metadata: request.metadata,
            mediaUri: request.mediaURI,
            levelName: request.levelName,
            monthName: request.monthName,
            year: request.year,
          }),
        }).then(res => res.json()).catch(err => ({
          success: false,
          error: err.message
        }))
      )
      
      const logResults = await Promise.allSettled(logPromises)
      
      // Check if any logs failed
      const failedLogs = logResults.filter(result => 
        result.status === 'rejected' || 
        (result.status === 'fulfilled' && !result.value.success)
      )
      
      if (failedLogs.length > 0) {
        console.warn(`${failedLogs.length} mint logs failed, but mints succeeded on-chain`)
      }

      setSuccess(`Successfully minted ${mintRequests.length} lower-tier NFTs!`)
      // Refresh the unminted tiers list
      await fetchUnmintedLowerTiers()
    } catch (err) {
      setError('Failed to batch mint lower tier NFTs')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Computed variables for better readability
  const isMintButtonDisabled = isMinted || loading || !address || !!pendingTxHash || isLoadingMonth || isLoadingMedia || !mediaURI

  return(
    <div className={isMainPage ? 'card-cyber p-6 mt-8' : ''}>
      {isMainPage && (
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-2xl font-bold font-proxima text-text-primary uppercase">{sectionNumber}. Mint your NFT</h2>
          <span className={`badge-cyber ${address ? 'text-accent' : 'text-text-secondary'}`}>
            {address ? 'Ready' : 'Locked'}
          </span>
        </div>
      )}
      {isMainPage && <p className="text-text-secondary mb-4">Your NFT is minted from the Botanix contract. Media is managed per month and role.</p>}

      <div className="flex gap-5 flex-wrap mt-4">
        <div className="flex-1 min-w-[300px]">
          {/* Show transaction success link above button when just minted (in current session only) */}
          {!alreadyMinted && localMinted && pendingTxHash && (
            <div className="mb-4 card-cyber p-3">
              <p className="text-success font-bold mb-2">✓ NFT minted successfully!</p>
              <a 
                href={`${chainConfig.explorerUrl}/tx/${pendingTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-accent underline font-medium text-sm hover:text-accent-neon transition-colors"
              >
                View on Explorer →
              </a>
            </div>
          )}

          <div className="flex gap-3 mt-5">
            <button
              onClick={handleMint}
              disabled={isMintButtonDisabled}
              className="btn-cyber w-full"
            >
              {isLoadingMonth || isLoadingMedia ? 'Loading...' : loading ? 'Minting...' : pendingTxHash ? 'Minting...' : isMinted ? 'Minted, see you next month!' : 'Mint your NFT (Freemint)'}
            </button>
          </div>

          {isMinted && unmintedLowerTiers.length > 0 && (
            <div className="mt-4">
              <p className="text-text-secondary text-sm text-center mb-3">
                You have {unmintedLowerTiers.length} lower-tier NFT{unmintedLowerTiers.length > 1 ? 's' : ''} available to mint: {unmintedLowerTiers.map(t => t.name).join(', ')}
              </p>
              <button
                onClick={handleBatchMintLowerTiers}
                disabled={loading || !address}
                className="btn-cyber w-full"
              >
                {loading ? 'Minting All Lower Tiers...' : `Batch Mint All ${unmintedLowerTiers.length} Lower Tier${unmintedLowerTiers.length > 1 ? 's' : ''} (Freemint)`}
              </button>
            </div>
          )}

          {!isMinted && error && <p className="text-error mt-3 text-sm">{error}</p>}
          {!isMinted && success && <p className="text-success mt-2 font-bold">{success}</p>}
          {isMinted && success && <p className="text-success mt-3 text-sm font-bold">{success}</p>}
          {isMinted && error && <p className="text-error mt-3 text-sm">{error}</p>}
          {!isMinted && !address && <p className="mt-2 text-text-secondary text-sm">Connect your wallet first.</p>}
        </div>

        <div className="flex-1 min-w-[300px]">
          <div className="card-cyber p-4 flex justify-center items-center">
            {isLoadingMonth || isLoadingMedia ? (
              <div className="max-w-full max-h-96 flex items-center justify-center">
                <p className="text-text-secondary">Loading media...</p>
              </div>
            ) : mediaGatewayURL ? (
              <img 
                src={mediaGatewayURL} 
                alt={`${roleName} NFT`}
                className="max-w-full max-h-96 object-contain"
                style={{filter: 'drop-shadow(0 0 10px rgba(255, 217, 102, 0.3))'}}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = FALLBACK_IMAGE
                }}
              />
            ) : (
              <img 
                src={FALLBACK_IMAGE} 
                alt="No media available"
                className="max-w-full max-h-96 object-contain"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

