/**
 * Media configuration for NFTs by level and month
 * This replaces the contract-stored media URIs from the old implementation
 */

/**
 * Helper function to convert CID to ipfs:// URI
 */
function cidToIpfsUri(cid: string): string {
  if (!cid) return ''
  // If already has ipfs:// prefix, return as-is (backward compatibility)
  if (cid.startsWith('ipfs://')) return cid
  // Otherwise, prepend ipfs:// to the CID
  return `ipfs://${cid}`
}

// Type definitions for media configuration
export interface MediaConfig {
  ipfsUri: string
  description?: string
}

export interface MonthMediaConfig {
  [monthName: string]: MediaConfig
}

export interface LevelMediaConfig {
  [year: number]: MonthMediaConfig
}

export interface AllMediaConfig {
  [levelName: string]: LevelMediaConfig
}

// Media configuration by level, year, and month
// Format: MEDIA_LINKS[levelName][year][monthName]
// NOTE: Fallback URIs are placeholders - ensure environment variables are set in production
export const MEDIA_LINKS: AllMediaConfig = {
  'Botanist': {
    2025: {
      'January': {
        ipfsUri: cidToIpfsUri(process.env.NEXT_PUBLIC_BOTANIST_2025_JAN || ''),
        description: 'Botanist January 2025'
      },
      'February': {
        ipfsUri: cidToIpfsUri(process.env.NEXT_PUBLIC_BOTANIST_2025_FEB || ''),
        description: 'Botanist February 2025'
      },
      // Add more months as needed
    },
    2026: {
      'January': {
        ipfsUri: cidToIpfsUri(process.env.NEXT_PUBLIC_BOTANIST_2026_JAN || ''),
        description: 'Botanist January 2026'
      },
    }
  },
  'Hyperion Ambassador': {
    2025: {
      'January': {
        ipfsUri: cidToIpfsUri(process.env.NEXT_PUBLIC_HYPERION_2025_JAN || ''),
        description: 'Hyperion Ambassador January 2025'
      },
    }
  },
  'Sequoia Ambassador': {
    2025: {
      'January': {
        ipfsUri: cidToIpfsUri(process.env.NEXT_PUBLIC_SEQUOIA_2025_JAN || ''),
        description: 'Sequoia Ambassador January 2025'
      },
    }
  },
  'Blossom Ambassador': {
    2025: {
      'January': {
        ipfsUri: cidToIpfsUri(process.env.NEXT_PUBLIC_BLOSSOM_2025_JAN || ''),
        description: 'Blossom Ambassador January 2025'
      },
    }
  },
  'Seedling Ambassador': {
    2025: {
      'January': {
        ipfsUri: cidToIpfsUri(process.env.NEXT_PUBLIC_SEEDLING_2025_JAN || ''),
        description: 'Seedling Ambassador January 2025'
      },
    }
  },
  'Sprout': {
    2025: {
      'January': {
        ipfsUri: cidToIpfsUri(process.env.NEXT_PUBLIC_SPROUT_2025_JAN || ''),
        description: 'Sprout January 2025'
      },
    }
  }
}

/**
 * Get media URI for a specific level, year, and month
 */
export function getMediaURI(levelName: string, year: number, monthName: string): string | null {
  const levelConfig = MEDIA_LINKS[levelName]
  if (!levelConfig) {
    console.warn(`No media config found for level: ${levelName}`)
    return null
  }

  const yearConfig = levelConfig[year]
  if (!yearConfig) {
    console.warn(`No media config found for level ${levelName} year ${year}`)
    return null
  }

  const monthConfig = yearConfig[monthName]
  if (!monthConfig) {
    console.warn(`No media config found for level ${levelName} year ${year} month ${monthName}`)
    return null
  }

  return monthConfig.ipfsUri
}

/**
 * Validate that media URI exists for given parameters
 */
export function validateMediaConfig(levelName: string, year: number, monthName: string): boolean {
  return getMediaURI(levelName, year, monthName) !== null
}

/**
 * Get all available months for a level and year
 */
export function getAvailableMonths(levelName: string, year: number): string[] {
  const levelConfig = MEDIA_LINKS[levelName]
  if (!levelConfig) return []

  const yearConfig = levelConfig[year]
  if (!yearConfig) return []

  return Object.keys(yearConfig)
}

/**
 * Convert IPFS URI to gateway URL
 */
export function ipfsToGateway(ipfsUri: string, gateway?: string): string {
  const defaultGateway = gateway || process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs'
  
  if (ipfsUri.startsWith('ipfs://')) {
    return `${defaultGateway}/${ipfsUri.replace('ipfs://', '')}`
  }
  
  return ipfsUri
}
