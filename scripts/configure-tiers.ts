/**
 * Script to configure tiers in the NFT contract
 * 
 * This script helps configure tiers (levelName, yearValue, monthName combinations)
 * in the BotanixAmbassadorNFT contract. Tiers must be configured and set to active
 * before users can mint NFTs for that tier.
 * 
 * Usage:
 *   npx ts-node scripts/configure-tiers.ts
 * 
 * Or with custom parameters:
 *   PRIVATE_KEY=0x... CONTRACT_ADDRESS=0x... npx ts-node scripts/configure-tiers.ts
 */

import { ethers } from 'ethers'

// Configuration
const PRIVATE_KEY = process.env.BACKEND_PRIVATE_KEY || process.env.PRIVATE_KEY
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || process.env.CONTRACT_ADDRESS
const RPC_URL = process.env.RPC_URL || 'https://rpc.botanixlabs.com' // Botanix mainnet
const CHAIN_ID = process.env.NEXT_PUBLIC_NETWORK_ID ? parseInt(process.env.NEXT_PUBLIC_NETWORK_ID) : 3637

// ABI for the configureTier function
const CONTRACT_ABI = [
  'function configureTier(string levelName, uint256 yearValue, string monthName, string name, string description, string baseURI, string imageURI, bool active, uint256 maxSupply) external',
  'function configureTierBatch(string[] levelNames, uint256[] yearValues, string[] monthNames, string[] names, string[] descriptions, string[] baseURIs, string[] imageURIs, bool[] actives, uint256[] maxSupplies) external',
  'function getTierInfo(string levelName, uint256 yearValue, string monthName) view returns (tuple(string name, string description, string baseURI, string imageURI, bool active, uint256 maxSupply, uint256 currentSupply))',
  'function owner() view returns (address)'
]

// Level names (Discord roles)
const LEVEL_NAMES = [
  'Botanist',
  'Hyperion Ambassador',
  'Sequoia Ambassador', 
  'Blossom Ambassador',
  'Seedling Ambassador',
  'Sprout'
]

// Month names
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

interface TierConfig {
  levelName: string
  yearValue: number
  monthName: string
  name: string
  description: string
  baseURI: string
  imageURI: string
  active: boolean
  maxSupply: number
}

async function main() {
  // Validate configuration
  if (!PRIVATE_KEY) {
    console.error('❌ Error: PRIVATE_KEY or BACKEND_PRIVATE_KEY environment variable is required')
    console.log('\nSet it in your .env.local file or pass it as an environment variable:')
    console.log('  PRIVATE_KEY=0x... npx ts-node scripts/configure-tiers.ts')
    process.exit(1)
  }

  if (!CONTRACT_ADDRESS) {
    console.error('❌ Error: CONTRACT_ADDRESS or NEXT_PUBLIC_NFT_CONTRACT_ADDRESS environment variable is required')
    console.log('\nSet it in your .env.local file or pass it as an environment variable:')
    console.log('  CONTRACT_ADDRESS=0x... npx ts-node scripts/configure-tiers.ts')
    process.exit(1)
  }

  console.log('🔧 Tier Configuration Script')
  console.log('============================')
  console.log(`Network: ${CHAIN_ID === 3637 ? 'Botanix Mainnet' : 'Botanix Testnet'}`)
  console.log(`RPC URL: ${RPC_URL}`)
  console.log(`Contract: ${CONTRACT_ADDRESS}`)
  console.log('')

  // Connect to provider
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL)
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet)

  // Verify owner
  try {
    const owner = await contract.owner()
    console.log(`Contract owner: ${owner}`)
    console.log(`Your address: ${wallet.address}`)
    
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
      console.error('\n❌ Error: You are not the contract owner!')
      console.log('Only the contract owner can configure tiers.')
      process.exit(1)
    }
    console.log('✅ Owner verification passed\n')
  } catch (error) {
    console.error('❌ Error verifying contract owner:', error)
    process.exit(1)
  }

  // Get current year and determine which year(s) to configure
  const currentYear = new Date().getFullYear()
  const yearsToConfig = [currentYear, currentYear + 1] // Configure current and next year

  console.log(`📅 Will configure tiers for years: ${yearsToConfig.join(', ')}\n`)

  // Build tier configurations
  const tiers: TierConfig[] = []
  
  for (const year of yearsToConfig) {
    for (const levelName of LEVEL_NAMES) {
      for (const monthName of MONTH_NAMES) {
        tiers.push({
          levelName,
          yearValue: year,
          monthName,
          name: `${levelName} - ${monthName} ${year}`,
          description: `${levelName} - ${monthName} ${year}`,
          baseURI: '', // Can be set later or left empty to use mediaURI
          imageURI: '', // Can be set later or left empty to use mediaURI
          active: true, // Set to true to allow minting
          maxSupply: 0 // 0 = unlimited
        })
      }
    }
  }

  console.log(`📋 Total tiers to configure: ${tiers.length}`)
  console.log(`   (${LEVEL_NAMES.length} levels × ${MONTH_NAMES.length} months × ${yearsToConfig.length} years)\n`)

  // Check if any tiers are already configured
  console.log('🔍 Checking existing tier configurations...')
  let alreadyConfigured = 0
  const tiersToUpdate: TierConfig[] = []

  for (const tier of tiers) {
    try {
      const info = await contract.getTierInfo(tier.levelName, tier.yearValue, tier.monthName)
      // If tier has a name set, it's already configured
      if (info.name && info.name !== '') {
        alreadyConfigured++
        // Only add to update list if it's not active
        if (!info.active) {
          tiersToUpdate.push(tier)
        }
      } else {
        tiersToUpdate.push(tier)
      }
    } catch (error) {
      // Tier doesn't exist, add to update list
      tiersToUpdate.push(tier)
    }
  }

  console.log(`   ✅ Already configured and active: ${alreadyConfigured - tiersToUpdate.length}`)
  console.log(`   📝 Need configuration/update: ${tiersToUpdate.length}\n`)

  if (tiersToUpdate.length === 0) {
    console.log('🎉 All tiers are already configured and active!')
    console.log('No action needed.')
    return
  }

  // Confirm before proceeding
  console.log('⚠️  This will configure the following tiers on-chain:')
  console.log(`   - ${tiersToUpdate.length} tier configurations`)
  console.log(`   - All will be set to ACTIVE (users can mint)`)
  console.log(`   - Max supply will be UNLIMITED (0)`)
  console.log('')
  
  // Use batch configuration for efficiency
  const BATCH_SIZE = 20 // Configure 20 tiers per transaction to avoid gas limits
  const batches = Math.ceil(tiersToUpdate.length / BATCH_SIZE)

  console.log(`📦 Will process in ${batches} batch(es) of up to ${BATCH_SIZE} tiers each\n`)

  for (let i = 0; i < batches; i++) {
    const start = i * BATCH_SIZE
    const end = Math.min(start + BATCH_SIZE, tiersToUpdate.length)
    const batch = tiersToUpdate.slice(start, end)

    console.log(`\n📤 Batch ${i + 1}/${batches}: Configuring tiers ${start + 1}-${end}...`)

    const levelNames = batch.map(t => t.levelName)
    const yearValues = batch.map(t => t.yearValue)
    const monthNames = batch.map(t => t.monthName)
    const names = batch.map(t => t.name)
    const descriptions = batch.map(t => t.description)
    const baseURIs = batch.map(t => t.baseURI)
    const imageURIs = batch.map(t => t.imageURI)
    const actives = batch.map(t => t.active)
    const maxSupplies = batch.map(t => t.maxSupply)

    try {
      const tx = await contract.configureTierBatch(
        levelNames,
        yearValues,
        monthNames,
        names,
        descriptions,
        baseURIs,
        imageURIs,
        actives,
        maxSupplies
      )

      console.log(`   Transaction hash: ${tx.hash}`)
      console.log(`   Waiting for confirmation...`)
      
      const receipt = await tx.wait()
      
      console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`)
      console.log(`   Gas used: ${receipt.gasUsed.toString()}`)
    } catch (error: any) {
      console.error(`   ❌ Error in batch ${i + 1}:`, error.message)
      console.error('   Stopping further batches due to error.')
      process.exit(1)
    }
  }

  console.log('\n🎉 Tier configuration complete!')
  console.log('✅ Users can now mint NFTs for all configured tiers.')
  console.log('')
  console.log('📝 Summary:')
  console.log(`   - Configured tiers: ${tiersToUpdate.length}`)
  console.log(`   - Levels: ${LEVEL_NAMES.join(', ')}`)
  console.log(`   - Years: ${yearsToConfig.join(', ')}`)
  console.log(`   - Months: All 12 months`)
  console.log('')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
