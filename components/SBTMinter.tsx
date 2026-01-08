import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useConfig, useReadContract } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { SBT_ABI } from '@/lib/sbt-abi'
import { chainConfig } from '@/lib/chains'

// Role-specific contract configurations
// Each role has its own dedicated NFT contract
// Media URIs are now fetched from the contracts themselves
const ROLE_CONTRACTS: Record<string, { contractAddress: string }> = {
  'Botanist': {
    contractAddress: process.env.NEXT_PUBLIC_BOTANIST_CONTRACT_ADDRESS || '',
  },
  'Hyperion Ambassador': {
    contractAddress: process.env.NEXT_PUBLIC_HYPERION_CONTRACT_ADDRESS || '',
  },
  'Sequoia Ambassador': {
    contractAddress: process.env.NEXT_PUBLIC_SEQUOIA_CONTRACT_ADDRESS || '',
  },
  'Blossom Ambassador': {
    contractAddress: process.env.NEXT_PUBLIC_BLOSSOM_CONTRACT_ADDRESS || '',
  },
  'Seedling Ambassador': {
    contractAddress: process.env.NEXT_PUBLIC_SEEDLING_CONTRACT_ADDRESS || '',
  },
  'Sprout': {
    contractAddress: process.env.NEXT_PUBLIC_SPROUT_CONTRACT_ADDRESS || '',
  },
}

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

type MintStatus = 'unminted' | 'minting' | 'minted'

interface LowerTierMintState {
  status: MintStatus
  error?: string
  transactionHash?: string
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
  const [showLowerTiers, setShowLowerTiers] = useState(false)
  const [unmintedLowerTiers, setUnmintedLowerTiers] = useState<UnmintedLowerTier[]>([])
  const [lowerTierMintStates, setLowerTierMintStates] = useState<Record<string, LowerTierMintState>>({})
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null)
  // Map transaction hashes to tier names to track multiple simultaneous mints
  const [txHashToTierName, setTxHashToTierName] = useState<Record<string, string>>({})
  
  // Combine prop and local state to determine if minted
  const isMinted = alreadyMinted || localMinted
  
  // Default values for removed fields
  const metadata = 'student'
  const credentialType = 'Education'
  const issuerName = 'Botanix'
  const level = 1

  // Check if rendering in main page or modal context
  const isMainPage = sectionNumber > 0

  // Get role-specific contract
  const roleConfig = ROLE_CONTRACTS[roleName]
  const contractAddress = roleConfig?.contractAddress
  
  // Read the default media URI from the contract
  const { data: contractMediaURI, isLoading: isLoadingMediaURI } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SBT_ABI,
    functionName: 'defaultMediaURI',
    query: {
      enabled: !!contractAddress,
    },
  })
  
  // Use fetched media URI or fallback to empty string
  const mediaURI = (contractMediaURI as string) || ''
  
  // Convert IPFS URI to gateway URL for display
  const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs'
  const mediaGatewayURL = mediaURI.startsWith('ipfs://') 
    ? `${IPFS_GATEWAY}/${mediaURI.replace('ipfs://', '')}`
    : mediaURI

  // Check if contract address is configured for this role
  if (!contractAddress) {
    return (
      <div className={isMainPage ? 'card-cyber p-6 mt-8' : ''}>
        {isMainPage && (
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-2xl font-bold font-proxima text-text-primary uppercase">{sectionNumber}. Mint your SBT</h2>
            <span className="badge-cyber text-text-secondary">Not Configured</span>
          </div>
        )}
        <p className="text-error text-sm">
          NFT contract for role "{roleName}" is not configured. Please set the appropriate contract address in your environment variables.
        </p>
      </div>
    )
  }

  const { writeContractAsync: mintWithSignatureAsync, reset: resetWriteContract } = useWriteContract()

  // Helper function to fetch media URI from a contract
  const fetchMediaURIFromContract = async (contractAddr: string): Promise<string> => {
    try {
      const { readContract } = await import('wagmi/actions')
      const result = await readContract(config, {
        address: contractAddr as `0x${string}`,
        abi: SBT_ABI,
        functionName: 'defaultMediaURI',
      })
      return result as string
    } catch (error) {
      console.error(`Failed to fetch media URI from contract ${contractAddr}:`, error)
      return ''
    }
  }

  // Helper function to wait for transaction and log the mint
  const waitForTransactionAndLog = async (txHash: `0x${string}`, tierName: string) => {
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

      // Determine tier configuration
      const tierConfig = ROLE_CONTRACTS[tierName]
      if (!tierConfig) {
        console.error('No tier config found for logging')
        // Update state to show error for lower-tier mints
        if (tierName !== roleName) {
          setLowerTierMintStates(prev => ({
            ...prev,
            [tierName]: { status: 'unminted', error: 'Configuration error' }
          }))
        }
        // Remove from loggingInProgress on error
        setLoggingInProgress(prev => {
          const newSet = new Set(prev)
          newSet.delete(txHash)
          return newSet
        })
        return
      }

      // Fetch media URI from contract
      const tierMediaURI = await fetchMediaURIFromContract(tierConfig.contractAddress)

      // Call the log-mint API
      const response = await fetch('/api/nft/log-mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordId: discordId,
          walletAddress: address,
          contractAddress: tierConfig.contractAddress,
          transactionHash: txHash,
          roleName: tierName,
          credentialType: credentialType,
          metadata: metadata,
          mediaUri: tierMediaURI,
          level: level,
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        console.log('Mint event logged successfully:', data)
        
        // Update state based on whether this was main role or lower tier
        if (tierName === roleName) {
          // This was the main role mint - update local state
          setLocalMinted(true)
          setPendingTxHash(null)
          // Fetch unminted lower tiers to check if they exist
          fetchUnmintedLowerTiers().catch((err) => {
            console.error('Error fetching unminted lower tiers after mint:', err)
          })
        } else {
          // This was a lower-tier mint - update lower tier state
          setLowerTierMintStates(prev => ({
            ...prev,
            [tierName]: { status: 'minted', transactionHash: txHash }
          }))
          // Clean up the mapping for this transaction
          setTxHashToTierName(prev => {
            const newMap = { ...prev }
            delete newMap[txHash]
            return newMap
          })
        }
        // Keep transaction in loggingInProgress on success to prevent duplicate logging attempts
        // Note: This Set will grow with each mint, but the number of mints per session is typically small
      } else {
        console.error('Failed to log mint event:', data)
        // Even if logging fails, the mint succeeded on-chain
        // Still update state to show as minted
        if (tierName === roleName) {
          setLocalMinted(true)
          setPendingTxHash(null)
        } else {
          setLowerTierMintStates(prev => ({
            ...prev,
            [tierName]: { status: 'minted', transactionHash: txHash }
          }))
        }
        // Remove from loggingInProgress on API failure to allow retry
        setLoggingInProgress(prev => {
          const newSet = new Set(prev)
          newSet.delete(txHash)
          return newSet
        })
      }
    } catch (err) {
      console.error('Error waiting for transaction or logging mint event:', err)
      // Update state to show error for lower-tier mints
      if (tierName !== roleName) {
        setLowerTierMintStates(prev => ({
          ...prev,
          [tierName]: { status: 'unminted', error: 'Transaction confirmation failed' }
        }))
      } else {
        // Clear pending transaction hash for main role to allow retry
        setPendingTxHash(null)
      }
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

  // Initialize mint states when unminted tiers are loaded
  useEffect(() => {
    const initialStates: Record<string, LowerTierMintState> = {}
    unmintedLowerTiers.forEach(tier => {
      initialStates[tier.name] = { status: 'unminted' }
    })
    setLowerTierMintStates(initialStates)
  }, [unmintedLowerTiers])

  const handleMint = async () => {
    if (!address) {
      setError('Connect wallet first')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)
    resetWriteContract() // Reset previous transaction state
    
    try {
      // Fetch media URI from contract to ensure we have the latest value
      const currentMediaURI = await fetchMediaURIFromContract(contractAddress)
      
      if (!currentMediaURI) {
        setError('Failed to fetch media URI from contract')
        setLoading(false)
        return
      }
      
      // First, get the signature
      const response = await fetch('/api/nft/generate-mint-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userWalletAddress: address,
          metadata: metadata,
          mediaURI: currentMediaURI,
          credentialType: credentialType,
          issuerName: issuerName,
          level: level,
          discordId: discordId,
          roleName: roleName,
          contractAddress: contractAddress,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        
        // Handle specific error codes
        if (errorData.code === 'ALREADY_MINTED_ROLE') {
          setError(`You have already minted an SBT for the ${roleName} role`)
        } else if (errorData.code === 'ALREADY_MINTED_CONTRACT') {
          setError('You have already minted an SBT from this contract')
        } else if (errorData.code === 'MAX_MINTS_EXCEEDED') {
          setError('You have reached the maximum number of SBT mints')
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

      // Then, mint with the signature and capture the transaction hash
      const txHash = await mintWithSignatureAsync({
        address: contractAddress as `0x${string}`,
        abi: SBT_ABI,
        functionName: 'mintWithSignature',
        args: [
          address,
          metadata,
          currentMediaURI,
          credentialType,
          issuerName,
          BigInt(nonce),
          BigInt(level),
          signature as `0x${string}`,
        ],
      })
      
      // Store the pending transaction hash and map it to the main role name
      setPendingTxHash(txHash)
      setTxHashToTierName(prev => ({
        ...prev,
        [txHash]: roleName
      }))
      
      // Wait for transaction and log it (don't await - let it run in background)
      waitForTransactionAndLog(txHash, roleName).catch((err) => {
        console.error('Unhandled error in waitForTransactionAndLog:', err)
      })
    } catch (err) {
      setError('Failed to mint SBT')
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

  // Handle minting of a specific lower-tier SBT
  const handleLowerTierMint = async (tierName: string) => {
    if (!address) {
      setLowerTierMintStates(prev => ({
        ...prev,
        [tierName]: { status: 'unminted', error: 'Connect wallet first' }
      }))
      return
    }

    const tierRoleConfig = ROLE_CONTRACTS[tierName]
    
    if (!tierRoleConfig || !tierRoleConfig.contractAddress) {
      setLowerTierMintStates(prev => ({
        ...prev,
        [tierName]: { status: 'unminted', error: `Contract not configured for ${tierName}` }
      }))
      return
    }

    // Update state to show this tier is minting
    setLowerTierMintStates(prev => ({
      ...prev,
      [tierName]: { status: 'minting' }
    }))

    try {
      // Fetch media URI from the tier contract
      const tierMediaURI = await fetchMediaURIFromContract(tierRoleConfig.contractAddress)
      
      // Get the signature
      const response = await fetch('/api/nft/generate-mint-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userWalletAddress: address,
          metadata: metadata,
          mediaURI: tierMediaURI,
          credentialType: credentialType,
          issuerName: issuerName,
          level: level,
          discordId: discordId,
          roleName: tierName,
          contractAddress: tierRoleConfig.contractAddress,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        let errorMessage = errorData.error || 'Failed to get signature'
        
        if (errorData.code === 'ALREADY_MINTED_ROLE') {
          errorMessage = 'Already minted'
          setLowerTierMintStates(prev => ({
            ...prev,
            [tierName]: { status: 'minted' }
          }))
        } else if (errorData.code === 'PENDING_MINT') {
          setLowerTierMintStates(prev => ({
            ...prev,
            [tierName]: { status: 'unminted', error: 'You already have a pending mint for this role. Please wait...' }
          }))
        } else {
          setLowerTierMintStates(prev => ({
            ...prev,
            [tierName]: { status: 'unminted', error: errorMessage }
          }))
        }
        return
      }

      const data = await response.json()
      const signature = data.signature
      const nonce = data.nonce

      // Mint with the signature and capture the transaction hash
      const txHash = await mintWithSignatureAsync({
        address: tierRoleConfig.contractAddress as `0x${string}`,
        abi: SBT_ABI,
        functionName: 'mintWithSignature',
        args: [
          address,
          metadata,
          tierMediaURI,
          credentialType,
          issuerName,
          BigInt(nonce),
          BigInt(level),
          signature as `0x${string}`,
        ],
      })
      
      // Immediately map the transaction hash to the tier name
      setTxHashToTierName(prev => ({
        ...prev,
        [txHash]: tierName
      }))
      
      // Wait for transaction and log it (don't await - let it run in background)
      waitForTransactionAndLog(txHash, tierName).catch((err) => {
        console.error('Unhandled error in waitForTransactionAndLog:', err)
      })
    } catch (err) {
      setLowerTierMintStates(prev => ({
        ...prev,
        [tierName]: { status: 'unminted', error: `Failed to mint: ${err}` }
      }))
      console.error(err)
    }
  }

  return(
    <div className={isMainPage ? 'card-cyber p-6 mt-8' : ''}>
      {isMainPage && (
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-2xl font-bold font-proxima text-text-primary uppercase">{sectionNumber}. Mint your SBT</h2>
          <span className={`badge-cyber ${address ? 'text-accent' : 'text-text-secondary'}`}>
            {address ? 'Ready' : 'Locked'}
          </span>
        </div>
      )}
      {isMainPage && <p className="text-text-secondary mb-4">Your NFT is minted from a role-specific contract. The media is dynamically fetched from the contract.</p>}

      <div className="flex gap-5 flex-wrap mt-4">
        <div className="flex-1 min-w-[300px]">
          {/* Show transaction success link above button when just minted (in current session only) */}
          {!alreadyMinted && localMinted && pendingTxHash && (
            <div className="mb-4 card-cyber p-3">
              <p className="text-success font-bold mb-2">✓ SBT minted successfully!</p>
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
              disabled={isMinted || loading || !address || !!pendingTxHash || isLoadingMediaURI}
              className="btn-cyber w-full"
            >
              {isLoadingMediaURI ? 'Loading media...' : loading ? 'Minting...' : pendingTxHash ? 'Minting...' : isMinted ? 'Minted, see you next month!' : 'Mint your SBT (Freemint)'}
            </button>
          </div>

          {isMinted && unmintedLowerTiers.length > 0 && (
            <div className="mt-4">
              <a 
                href="#" 
                onClick={(e) => {
                  e.preventDefault()
                  setShowLowerTiers(!showLowerTiers)
                }}
                className="block text-accent underline font-medium text-sm text-center hover:text-accent-neon transition-colors uppercase tracking-wide"
              >
                Meanwhile, you can mint lower-tier SBTs to complete your collection
              </a>
              
              {showLowerTiers && (
                <div className="mt-3 flex flex-col gap-2">
                  {unmintedLowerTiers.map(tier => {
                    const mintState = lowerTierMintStates[tier.name] || { status: 'unminted' }
                    const isMinting = mintState.status === 'minting'
                    const isMinted = mintState.status === 'minted'
                    const canClick = mintState.status === 'unminted' && address
                    
                    return (
                      <div key={tier.id} className="flex flex-col gap-1">
                        <div>
                          {!isMinted && (
                            <a 
                              href="#" 
                              onClick={(e) => {
                                e.preventDefault()
                                if (canClick) {
                                  handleLowerTierMint(tier.name)
                                }
                              }}
                              className={`text-accent underline font-medium text-sm uppercase ${canClick ? 'cursor-pointer hover:text-accent-neon' : 'cursor-default opacity-60'} transition-colors`}
                            >
                              {`Mint ${tier.name}${isMinting ? '...Minting' : ''}`}
                            </a>
                          )}
                          {isMinted && (
                            <span>
                              <span className="text-accent text-sm font-medium opacity-60 uppercase">Mint {tier.name}...</span>
                              {mintState.transactionHash ? (
                                <a 
                                  href={`${chainConfig.explorerUrl}/tx/${mintState.transactionHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-accent underline text-sm font-medium opacity-60 hover:opacity-100 transition-opacity ml-1 uppercase"
                                  aria-label={`View ${tier.name} mint transaction on blockchain explorer`}
                                >
                                  Minted
                                </a>
                              ) : (
                                <span className="text-accent text-sm font-medium opacity-60 ml-1 uppercase">Minted</span>
                              )}
                            </span>
                          )}
                        </div>
                        {mintState.error && (
                          <p className="text-error mt-1 text-sm">{mintState.error}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {!isMinted && error && <p className="text-error mt-3 text-sm">{error}</p>}
          {!isMinted && success && <p className="text-success mt-2 font-bold">{success}</p>}
          {!isMinted && !address && <p className="mt-2 text-text-secondary text-sm">Connect your wallet first.</p>}
        </div>

        <div className="flex-1 min-w-[300px]">
          <div className="card-cyber p-4 flex justify-center items-center">
            {isLoadingMediaURI ? (
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

