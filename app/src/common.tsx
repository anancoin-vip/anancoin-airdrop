import { BaseWalletMultiButton } from '@solana/wallet-adapter-react-ui'

import { LABELS } from './utils'

export default function Common () {
  return (
    <div className="card" title="公共">
      <BaseWalletMultiButton labels={LABELS} />
    </div>
  )
}
