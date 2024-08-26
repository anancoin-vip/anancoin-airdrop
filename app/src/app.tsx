import { useCallback, useEffect, useState } from 'react'
import { useWallet, useConnection, useAnchorWallet } from '@solana/wallet-adapter-react'
import { Program, AnchorProvider, setProvider, BN, web3 } from '@coral-xyz/anchor'
import { getAssociatedTokenAddress, getAssociatedTokenAddressSync } from '@solana/spl-token'

import { txUrl } from './utils'
// @ts-ignore
import lemconnTokenAirdropIdl from './anancoin_airdrop.json'

const lemconnTokenMint = new web3.PublicKey('45BTxq4W6gmpHmcbaZCMHhvVma6Eb4DvMYPcG77NRMXH')
const programId = new web3.PublicKey('sEs461DSnSm3m9ssbWZ6j8WXrWJm96owZsAgwVSVKqB')

export default function App () {
  const { publicKey, sendTransaction } = useWallet()
  const { connection } = useConnection()
  const wallet = useAnchorWallet()

  const [program, setProgram] = useState()

  useEffect(() => {
    const provider = new AnchorProvider(connection, wallet, {})
    setProvider(provider)

    const program = new Program(lemconnTokenAirdropIdl, programId)
    setProgram(program)
    console.log('>---program::', program)
  }, [connection, wallet])

  const initContract = useCallback(async () => {
    console.log('>>>initContract::')
    const [lemconnContractDataPubkey, lemconnContractDataBump] = web3.PublicKey.findProgramAddressSync([publicKey.toBuffer()], program.programId)
    console.log('>>>lemconnContractDataPubkey::', lemconnContractDataPubkey, lemconnContractDataBump)

    try {
      const tx = program.instruction.initialize(lemconnContractDataBump, {
        accounts: {
          lemconnContractDataAccount: lemconnContractDataPubkey,
          lemconnVaultAccount: publicKey,
          lemconnOwnerAccount: publicKey,
          systemProgram: web3.SystemProgram.programId,
        }
      })
      const transaction = new web3.Transaction().add(tx)
      const signature = await sendTransaction(transaction, connection, { signers: [] })
  
      console.log('signature', signature)
      console.log('>>>tx::', txUrl(signature))
    } catch (error) {
      console.log('>>>error::', error)
    }
  }, [publicKey, program, wallet, connection, sendTransaction])

  const addToken = useCallback(async () => {
    // PDA
    // GG6amj2BmRwwjG54ZMXphBeV3rMayzjCQvzv1xtiN1q5
    // 254
    const [lemconnContractDataPubkey, lemconnContractDataBump] = web3.PublicKey.findProgramAddressSync([publicKey.toBuffer()], program.programId)
    // 创建销售账户（PDA）
    const lemconnPdaAccount = await getAssociatedTokenAddress(
      lemconnTokenMint,
      lemconnContractDataPubkey,
      true
    );
    const lemconnTokenMasterAccount = await getAssociatedTokenAddressSync(lemconnTokenMint, publicKey)

    // 创建代币数据账户
    const [lemconnTokenDataPublicKey, _] = web3.PublicKey.findProgramAddressSync(
      [lemconnTokenMint.toBuffer()], program.programId);
    const tx = program.instruction.addToken(
      new BN(500000),
      6,
      new BN(0.0001 * web3.LAMPORTS_PER_SOL),
      {accounts: {
        lemconnTokenDataAccount: lemconnTokenDataPublicKey,
        lemconnTokenPdaAccount: lemconnPdaAccount,
        lemconnTokenMasterAccount,
        lemconnTokenMintAccount: lemconnTokenMint,
        lemconnContractDataAccount: lemconnContractDataPubkey,
        lemconnOwnerAccount: publicKey,
        associatedTokenProgram: new web3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
        tokenProgram: new web3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        systemProgram: web3.SystemProgram.programId,
      }}
    )
    const transaction = new web3.Transaction().add(tx)
    const signature = await sendTransaction(transaction, connection, { signers: [] })

    console.log('signature', signature)
    console.log('>>>tx::', txUrl(signature))
  }, [program, publicKey, connection, sendTransaction])

  const claimToken = useCallback(async () => {
    const userTokenAccount = await getAssociatedTokenAddressSync(lemconnTokenMint, publicKey)
    const [lemconnContractDataPubkey, lemconnContractDataBump] = web3.PublicKey.findProgramAddressSync([new web3.PublicKey('3hEqw25maKp7u4isAZCZRGDymXcf2akVVFfE66cSht8e').toBuffer()], program.programId)
    // const lemconnContractDataPubkey = new web3.PublicKey('GG6amj2BmRwwjG54ZMXphBeV3rMayzjCQvzv1xtiN1q5')
    // 创建销售账户（PDA）
    const lemconnPdaAccount = await getAssociatedTokenAddress(
      lemconnTokenMint,
      lemconnContractDataPubkey,
      true
    );
    console.log('>>>userTokenAccount', userTokenAccount)
    // 创建代币数据账户
    const [lemconnTokenDataPublicKey, _] = web3.PublicKey.findProgramAddressSync(
      [lemconnTokenMint.toBuffer()], program.programId);
    const tx = program.instruction.claimToken(new BN(100), {accounts: {
      userTokenAccount,
      userOwnerAccount: publicKey,
      lemconnTokenMintAccount: lemconnTokenMint,
      lemconnTokenPdaAccount: lemconnPdaAccount,
      lemconnTokenDataAccount: lemconnTokenDataPublicKey,
      lemconnContractDataAccount: lemconnContractDataPubkey,
      lemconnVaultAccount: new web3.PublicKey('3hEqw25maKp7u4isAZCZRGDymXcf2akVVFfE66cSht8e'),
      associatedTokenProgram: new web3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
      tokenProgram: new web3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      systemProgram: web3.SystemProgram.programId,
    }})

    console.log('>>>tx', tx)

    const transaction = new web3.Transaction().add(tx)
    const signature = await sendTransaction(transaction, connection)

    await connection.confirmTransaction(signature, 'processed')

    console.log('signature', signature)
    console.log('>>>tx::', txUrl(signature))
  }, [publicKey, connection, program, sendTransaction])
  
  return (
    <div className="card" title="合约">
      <button onClick={initContract}>initContract</button>
      <button onClick={addToken}>addToken</button>
      <button onClick={claimToken}>claimToken</button>
    </div>
  )
}
