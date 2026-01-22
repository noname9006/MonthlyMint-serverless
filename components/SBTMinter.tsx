import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useConfig } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { ethers } from 'ethers'
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
  
  // Removed fields - using empty values for backward compatibility with contract
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
  const waitForTransactionAndLog = async (txHash: `0x${string}`, tierName: string, tierMediaURI: string, tierMonthName: string, tierYear: number, requestId?: string) => {
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
          mediaUri: tierMediaURI,
          levelName: tierName,
          monthName: tierMonthName,
          year: tierYear,
          requestId: requestId,
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
          metadata: '',  // Removed - using empty string for contract compatibility
          mediaURI: mediaURI,
          credentialType: '',  // Removed - using empty string for contract compatibility
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
          '',  // metadata - removed
          mediaURI,
          '',  // credentialType - removed
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
      waitForTransactionAndLog(txHash, roleName, mediaURI, currentMonth.monthName, currentMonth.year, requestId).catch((err) => {
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
      
      console.log(`Preparing batch mint for ${unmintedLowerTiers.length} lower tiers`)
      
      for (const tier of unmintedLowerTiers) {
        console.log(`Fetching media for tier: ${tier.name}, month: ${currentMonth.monthName}, year: ${currentMonth.year}`)
        
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
            console.log(`✓ Media found in database for ${tier.name}: ${tierMediaURI}`)
          } else {
            console.warn(`Database media fetch returned no CID for ${tier.name}`)
          }
        } else {
          console.warn(`Database media fetch failed for ${tier.name}: ${mediaResponse.status}`)
        }
        
        // Fallback to environment variables if database fetch failed
        if (!tierMediaURI) {
          tierMediaURI = getMediaURI(tier.name, currentMonth.year, currentMonth.monthName)
          if (tierMediaURI) {
            console.log(`✓ Media found in environment config for ${tier.name}: ${tierMediaURI}`)
          } else {
            console.error(`✗ No media found for ${tier.name} in database or environment config`)
          }
        }
        
        if (!tierMediaURI) {
          setError(`Media not available for ${tier.name}`)
          setLoading(false)
          return
        }
        
        // Validate IPFS URI format
        if (!tierMediaURI.startsWith('ipfs://')) {
          console.error(`✗ Invalid media URI format for ${tier.name}: ${tierMediaURI}`)
          setError(`Invalid media URI format for ${tier.name}`)
          setLoading(false)
          return
        }

        mintRequests.push({
          metadata: '',  // Removed - using empty string for contract compatibility
          mediaURI: tierMediaURI,
          credentialType: '',  // Removed - using empty string for contract compatibility
          issuerName: issuerName,
          roleName: tier.name,
          levelName: tier.name,
          monthName: currentMonth.monthName,
          year: currentMonth.year,
        })
      }
      
      // Final validation: ensure all requests have valid data
      console.log(`Validating ${mintRequests.length} mint requests before batch mint...`)
      for (let i = 0; i < mintRequests.length; i++) {
        const req = mintRequests[i]
        if (!req.mediaURI || !req.issuerName || !req.levelName) {
          console.error(`✗ Invalid mint request at index ${i}:`, req)
          setError(`Invalid data for ${req.levelName || 'unknown tier'}`)
          setLoading(false)
          return
        }
      }
      console.log(`✓ All ${mintRequests.length} mint requests validated successfully`)
      
      // Log the prepared batch mint data for debugging
      console.log('Batch mint prepared with:', {
        tierCount: mintRequests.length,
        tiers: mintRequests.map(r => r.levelName),
        mediaURIs: mintRequests.map(r => r.mediaURI)
      })

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
      
      // Verify all arrays have the same length
      const expectedLength = mintRequests.length
      if (data.signatures.length !== expectedLength ||
          data.requestIds.length !== expectedLength ||
          data.years.length !== expectedLength ||
          data.metadatas.length !== expectedLength ||
          data.mediaURIs.length !== expectedLength ||
          data.credentialTypes.length !== expectedLength ||
          data.issuerNames.length !== expectedLength ||
          data.levelNames.length !== expectedLength ||
          data.monthNames.length !== expectedLength) {
        console.error('Array length mismatch in signature response:', {
          expected: expectedLength,
          signatures: data.signatures.length,
          requestIds: data.requestIds.length,
          mediaURIs: data.mediaURIs.length,
          metadatas: data.metadatas.length,
          credentialTypes: data.credentialTypes.length
        })
        setError('Data mismatch in batch mint signature response')
        setLoading(false)
        return
      }
      
      // Verify all data is properly populated AND matches original request
      for (let i = 0; i < expectedLength; i++) {
        if (!data.mediaURIs[i] || !data.issuerNames[i] || !data.levelNames[i] || !data.monthNames[i] || !data.years[i]) {
          console.error(`Missing data at index ${i}:`, {
            mediaURI: data.mediaURIs[i],
            issuerName: data.issuerNames[i],
            levelName: data.levelNames[i],
            monthName: data.monthNames[i],
            year: data.years[i]
          })
          setError(`Missing required data for tier at index ${i}`)
          setLoading(false)
          return
        }
        
        // Verify data alignment: ensure response matches request order
        if (data.levelNames[i] !== mintRequests[i].levelName) {
          console.error(`Tier name mismatch at index ${i}: expected ${mintRequests[i].levelName}, got ${data.levelNames[i]}`)
          setError(`Data mismatch: tier names don't match between request and response`)
          setLoading(false)
          return
        }
        
        if (data.mediaURIs[i] !== mintRequests[i].mediaURI) {
          console.error(`Media URI mismatch at index ${i}: expected ${mintRequests[i].mediaURI}, got ${data.mediaURIs[i]}`)
          setError(`Data mismatch: media URIs don't match between request and response`)
          setLoading(false)
          return
        }
      }
      
      console.log(`✓ Batch signature response validated: all ${expectedLength} entries have complete data`)
      
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

      console.log(`✓ Batch mint transaction submitted: ${txHash}`)
      console.log(`Waiting for transaction confirmation...`)

      // Wait for transaction confirmation
      const receipt = await waitForTransactionReceipt(config, {
        hash: txHash,
      })

      console.log(`✓ Batch mint transaction confirmed in block ${receipt.blockNumber}`)
      console.log(`Transaction status: ${receipt.status}`)
      
      if (receipt.status !== 'success') {
        console.error('Transaction failed on-chain')
        setError('Batch mint transaction failed')
        setLoading(false)
        return
      }

      // Extract tokenIds from BatchMinted event in the receipt
      const batchMintedEvent = receipt.logs.find((log: any) => {
        try {
          // BatchMinted event signature: BatchMinted(address indexed to, uint256[] tokenIds, uint256 count)
          const eventSignature = ethers.utils.keccak256(
            ethers.utils.toUtf8Bytes('BatchMinted(address,uint256[],uint256)')
          )
          return log.topics[0] === eventSignature
        } catch {
          return false
        }
      })

      let tokenIds: bigint[] = []
      if (batchMintedEvent) {
        try {
          // Decode the event data to extract tokenIds array
          const abiCoder = new ethers.utils.AbiCoder()
          const decoded = abiCoder.decode(['uint256[]', 'uint256'], batchMintedEvent.data)
          tokenIds = decoded[0] // First element is the tokenIds array
          console.log(`✓ Extracted ${tokenIds.length} tokenIds from BatchMinted event:`, tokenIds.map((id: bigint) => id.toString()))
        } catch (err) {
          console.error('Failed to decode BatchMinted event:', err)
        }
      } else {
        console.warn('BatchMinted event not found in receipt logs')
      }

      // Log each mint individually with retry logic to ensure all mints are recorded
      // Constants for retry configuration
      const MAX_RETRY_DELAY_MS = 5000 // Cap retry delay at 5 seconds
      const MAX_RETRIES = 3
      
      // Helper function to calculate exponential backoff delay with cap
      const getRetryDelay = (attempt: number): number => Math.min(1000 * Math.pow(2, attempt), MAX_RETRY_DELAY_MS)
      
      // Helper function to log a single mint with retry
      const logMintWithRetry = async (request: any, index: number, retries = MAX_RETRIES): Promise<{ success: boolean; error?: string }> => {
        for (let attempt = 0; attempt < retries; attempt++) {
          try {
            const response = await fetch('/api/nft/log-mint', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                discordId: discordId,
                walletAddress: address,
                contractAddress: NFT_CONTRACT_ADDRESS,
                transactionHash: txHash,
                tokenId: tokenIds[index] ? tokenIds[index].toString() : undefined, // Include tokenId if available
                roleName: request.levelName,
                mediaUri: request.mediaURI,
                levelName: request.levelName,
                monthName: request.monthName,
                year: request.year,
                requestId: data.requestIds[index],
              }),
            })
            
            const result = await response.json()
            
            if (result.success) {
              console.log(`Successfully logged mint for ${request.levelName} with tokenId ${tokenIds[index]?.toString() || 'N/A'} (attempt ${attempt + 1})`)
              return { success: true }
            } else {
              console.warn(`Failed to log mint for ${request.levelName} (attempt ${attempt + 1}): ${result.error}`)
              if (attempt < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, getRetryDelay(attempt)))
              }
            }
          } catch (err) {
            console.error(`Error logging mint for ${request.levelName} (attempt ${attempt + 1}):`, err)
            if (attempt < retries - 1) {
              await new Promise(resolve => setTimeout(resolve, getRetryDelay(attempt)))
            }
          }
        }
        
        return { 
          success: false, 
          error: `Failed after ${retries} attempts` 
        }
      }
      
      // Log all mints in parallel to avoid blocking on failures
      console.log(`Logging ${mintRequests.length} mints in parallel...`)
      const logResults: Array<{ success: boolean; error?: string }> = await Promise.all(
        mintRequests.map((request, index) => logMintWithRetry(request, index))
      )
      
      // Count successful and failed logs
      const successfulLogs = logResults.filter(r => r.success).length
      const failedLogs = logResults.filter(r => !r.success)
      
      console.log(`Batch mint logging complete: ${successfulLogs}/${mintRequests.length} successful`)
      
      if (failedLogs.length > 0) {
        console.error(`${failedLogs.length} mint logs failed after retries. These mints succeeded on-chain but were not recorded in the database.`)
        // Show clear message about partial success
        setSuccess(`All ${mintRequests.length} NFTs minted successfully! However, ${failedLogs.length} database ${failedLogs.length === 1 ? 'entry' : 'entries'} failed to save. Please contact support to update your records.`)
      } else {
        setSuccess(`Successfully minted ${mintRequests.length} lower-tier NFTs!`)
      }
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

