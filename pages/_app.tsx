import type { AppProps } from 'next/app'
import { RainbowKitProvider, darkTheme, getDefaultConfig } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'

import { botanix } from '@/lib/chains'

import '@rainbow-me/rainbowkit/styles.css'
import '@/styles/globals.css'

const queryClient = new QueryClient()

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

const wagmiConfig = getDefaultConfig({
  appName: 'Monthly Mint',
  projectId: walletConnectProjectId,
  chains: [botanix],
  ssr: true,
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider 
          theme={darkTheme({ 
            accentColor: '#ffd966',
            accentColorForeground: '#0a0a0a',
            borderRadius: 'none',
          })} 
          modalSize="compact"
        >
          <Component {...pageProps} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

