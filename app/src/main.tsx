import ReactDOM from 'react-dom/client'

import { clusterApiUrl } from '@solana/web3.js' 
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'

import Common from './common'
import App from './app'
import App2 from './2/app'
import App0530 from './0530/app'
import { cluster } from './utils'

import './style.less'

const wallets = [
  new PhantomWalletAdapter(),
]

ReactDOM.createRoot(document.getElementById('root')).render(
  <ConnectionProvider endpoint={clusterApiUrl(cluster)}>
    {/* @ts-ignore */}
    <WalletProvider wallets={wallets} autoConnect>
      <WalletModalProvider autoConnect>
        <Common />
        <App />
        <App2 />
        <App0530 />
      </WalletModalProvider>
    </WalletProvider>
  </ConnectionProvider>
)
