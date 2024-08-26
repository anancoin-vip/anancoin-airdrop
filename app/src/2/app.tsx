import { useCallback, useEffect, useState } from 'react'
import { useWallet, useConnection, useAnchorWallet } from '@solana/wallet-adapter-react'
import { Program, AnchorProvider, setProvider, BN, web3 } from '@coral-xyz/anchor'
import { getAssociatedTokenAddress, getAssociatedTokenAddressSync, NATIVE_MINT, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'

import { txUrl, wrapTx, unwrapTx, accountExists, createATA } from '../utils'
// @ts-ignore
import lemconnTokenAirdropIdl from './anancoin_airdrop.json'

const lemconnTokenMint = new web3.PublicKey('43zGoQe2LkXmGJHnHjTWXW7SggQPaDiULhPnATWfXqc8')
const programId = new web3.PublicKey("sEs461DSnSm3m9ssbWZ6j8WXrWJm96owZsAgwVSVKqB")

export default function App2 () {
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

  const close = useCallback(async () => {
    console.log('>>>close::')
    const [
      lemconnContractDataPubkey, 
      lemconnContractDataBump
    ] = web3.PublicKey.findProgramAddressSync([lemconnTokenMint.toBuffer(), publicKey.toBuffer()], program.programId)
    console.log('>>>lemconnContractDataPubkey::', lemconnContractDataPubkey, lemconnContractDataBump)
    // 创建销售账户（PDA）
    const lemconnPdaAccount = await getAssociatedTokenAddress(
      lemconnTokenMint,
      lemconnContractDataPubkey,
      true
    );

    const lemconnTokenMasterAccount = await getAssociatedTokenAddressSync(lemconnTokenMint, publicKey)

    try {
      const tx = program.instruction.close(
        {
          accounts: {
            lemconnOwnerAccount: publicKey,
            lemconnTokenMintAccount: lemconnTokenMint,
            lemconnTokenMasterAccount: lemconnTokenMasterAccount,
            lemconnTokenPdaAccount: lemconnPdaAccount,
            lemconnTokenPdaOwnerAccount: lemconnContractDataPubkey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
          }
        }
      )
      const transaction = new web3.Transaction().add(tx)
      const signature = await sendTransaction(transaction, connection, { signers: [], skipPreflight: true })
  
      console.log('signature', signature)
      console.log('>>>tx::', txUrl(signature))
    } catch (error) {
      console.log('>>>error::', error)
    }
  }, [publicKey, program, connection, sendTransaction])

  const initialize = useCallback(async () => {
    console.log('>>>initialize::')
    const [
      lemconnTokenPdaOwnerAccount, 
      lemconnContractDataBump
    ] = web3.PublicKey.findProgramAddressSync([lemconnTokenMint.toBuffer(), publicKey.toBuffer()], program.programId)
    // 创建销售账户（PDA）
    const lemconnTokenPdaAccount = await getAssociatedTokenAddress(lemconnTokenMint, lemconnTokenPdaOwnerAccount, true)
    const lemconnTokenMasterAccount = await getAssociatedTokenAddressSync(lemconnTokenMint, publicKey)
    const lemconnVaultAccount = await getAssociatedTokenAddressSync(NATIVE_MINT, publicKey)

    try {
      const tx = program.instruction.initialize(
        new BN(50000),
        new BN(0.001 * web3.LAMPORTS_PER_SOL),
        1,
        6,
        lemconnContractDataBump,
        {
          accounts: {
            lemconnOwnerAccount: publicKey,
            lemconnTokenPdaAccount,
            lemconnTokenPdaOwnerAccount,
            lemconnTokenMasterAccount,
            lemconnTokenMintAccount: lemconnTokenMint,
            lemconnVaultAccount,
            lemconnVaultMintAccount: NATIVE_MINT,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
          }
        }
      )
      const transaction = new web3.Transaction().add(tx)
      const signature = await sendTransaction(transaction, connection, { signers: [], skipPreflight: true })
  
      console.log('signature', signature)
      console.log('>>>tx::', txUrl(signature))
    } catch (error) {
      console.log('>>>error::', error)
    }
  }, [publicKey, program, connection, sendTransaction])

  const claim = useCallback(async () => {
    const lemconnPublicKey = new web3.PublicKey('BSMGQSBSuShqZGFju3KofkHJsRfUarhJMBG8sJfn6tQk')
    const userTokenAccount = await getAssociatedTokenAddressSync(lemconnTokenMint, publicKey)
    const [lemconnTokenDataPublicKey] = web3.PublicKey.findProgramAddressSync([lemconnTokenMint.toBuffer(), lemconnPublicKey.toBuffer()], program.programId);
    // 创建销售账户（PDA）
    const lemconnPdaAccount = await getAssociatedTokenAddress(lemconnTokenMint, lemconnTokenDataPublicKey, true)

    const userVaultAccount = await getAssociatedTokenAddressSync(NATIVE_MINT, publicKey)

    const lemconnVaultAccount = await getAssociatedTokenAddressSync(NATIVE_MINT, lemconnPublicKey)

    const transaction: any = new web3.Transaction()

    if (!(await accountExists(connection, userTokenAccount))) {
      transaction.add(await createATA(publicKey, lemconnTokenMint));
    }
  
  
    transaction.add(await wrapTx(connection, publicKey, 0.00002 * web3.LAMPORTS_PER_SOL * 100));

    transaction.add(program.instruction.claim(
      new BN(100),
      {
        accounts: {
          userOwnerAccount: publicKey,
          userTokenAccount,
          userVaultAccount,
          lemconnTokenPdaAccount: lemconnPdaAccount,
          lemconnTokenPdaOwnerAccount: lemconnTokenDataPublicKey,
          lemconnTokenMintAccount: lemconnTokenMint,
          lemconnVaultAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
        }
      }
    ))

    transaction.add(await unwrapTx(publicKey))

    const signature = await sendTransaction(transaction, connection, { signers: [], skipPreflight: true })

    // await connection.confirmTransaction(signature, 'processed')

    console.log('signature', signature)
    console.log('>>>tx::', txUrl(signature))
  }, [publicKey, connection, program, sendTransaction])

  const update = useCallback(async () => {
    console.log('>>>update::')
    const [lemconnTokenPdaOwnerAccount, lemconnContractDataBump] = web3.PublicKey.findProgramAddressSync([lemconnTokenMint.toBuffer(), publicKey.toBuffer()], program.programId)
    // 创建销售账户（PDA）
    const lemconnTokenPdaAccount = await getAssociatedTokenAddress(lemconnTokenMint, lemconnTokenPdaOwnerAccount, true)
    const lemconnTokenMasterAccount = await getAssociatedTokenAddressSync(lemconnTokenMint, publicKey)

    try {
      const tx = program.instruction.update(
        new BN(0.002 * web3.LAMPORTS_PER_SOL),
        true,
        new BN(100000),
        {
          accounts: {
            lemconnOwnerAccount: publicKey,
            lemconnTokenPdaOwnerAccount,
            lemconnTokenPdaAccount,
            lemconnTokenMasterAccount,
            lemconnTokenMintAccount: lemconnTokenMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
          }
        }
      )
      console.log('>>>tx', tx)
      const transaction = new web3.Transaction().add(tx)
      const signature = await sendTransaction(transaction, connection, { signers: [], skipPreflight: true })
  
      console.log('signature', signature)
      console.log('>>>tx::', txUrl(signature))
    } catch (error) {
      console.log('>>>error::', error)
    }
  }, [publicKey, program, connection, sendTransaction])
  
  return (
    <div className="card" title="合约新版本">
      <button onClick={initialize}>initialize</button>
      <button onClick={claim}>claim</button>
      <button onClick={update}>update</button>
      <button onClick={close}>close</button>
      <button onClick={async () => {
        const userTokenAccount = await getAssociatedTokenAddressSync(lemconnTokenMint, publicKey)
        console.log('>>>', userTokenAccount.toBase58())
      }}>userTokenAccount</button>
    </div>
  )
}
