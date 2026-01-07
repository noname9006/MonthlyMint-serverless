import { defineChain } from 'viem'

// Hardcoded network configurations
const NETWORKS = {
  3637: {
    id: 3637,
    name: 'Botanix',
    rpcUrl: 'https://rpc.botanixlabs.com',
    explorerUrl: 'https://botanixscan.io/',
    explorerName: 'Botanix Explorer',
  },
  3636: {
    id: 3636,
    name: 'Botanix Testnet',
    rpcUrl: 'https://node.botanixlabs.dev',
    explorerUrl: 'https://testnet.botanixscan.io/',
    explorerName: 'Botanix Testnet Explorer',
  },
}

// Select network based on NEXT_PUBLIC_NETWORK_ID environment variable
// Set NEXT_PUBLIC_NETWORK_ID to the chain ID (3636 for testnet, 3637 for mainnet)
// Defaults to mainnet (3637) if not set or invalid
// NOTE: Must use NEXT_PUBLIC_NETWORK_ID (not NETWORK_ID) to ensure consistency
// between server-side rendering and client-side hydration
const getNetworkId = (): number => {
  const publicNetworkId = process.env.NEXT_PUBLIC_NETWORK_ID 
    ? parseInt(process.env.NEXT_PUBLIC_NETWORK_ID, 10) 
    : NaN;
  
  if (!isNaN(publicNetworkId) && publicNetworkId in NETWORKS) {
    return publicNetworkId;
  }
  
  return 3637; // Default to mainnet
}

const networkId = getNetworkId();
const activeConfig = NETWORKS[networkId as keyof typeof NETWORKS] || NETWORKS[3637]

export const botanix = defineChain({
  id: activeConfig.id,
  name: activeConfig.name,
  nativeCurrency: {
    decimals: 18,
    name: 'Bitcoin',
    symbol: 'BTC',
  },
  rpcUrls: {
    default: {
      http: [activeConfig.rpcUrl],
    },
  },
  blockExplorers: {
    default: { name: activeConfig.explorerName, url: activeConfig.explorerUrl },
  },
})

// Export configuration constants for use in other components
export const chainConfig = {
  id: activeConfig.id,
  name: activeConfig.name,
  rpcUrl: activeConfig.rpcUrl,
  explorerUrl: activeConfig.explorerUrl,
  explorerName: activeConfig.explorerName,
}