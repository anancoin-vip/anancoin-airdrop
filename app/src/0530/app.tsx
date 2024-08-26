import { useCallback, useEffect, useState } from 'react'
import { useWallet, useConnection, useAnchorWallet } from '@solana/wallet-adapter-react'
import { Program, AnchorProvider, setProvider, BN, web3 } from '@coral-xyz/anchor'
import { getAssociatedTokenAddress, getAssociatedTokenAddressSync, NATIVE_MINT, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'

import { txUrl, wrapTx, unwrapTx, accountExists, createATA, getATA } from '../utils'
// @ts-ignore
import lemconnTokenAirdropIdl from './anancoin_airdrop.json'

// const lemconnOwnerAccount = new web3.PublicKey('8LpySyrj782B5dreaxD5WCRToNU3XS3Au2Ggqqivfr2L')
const lemconnOwnerAccount = new web3.PublicKey('Fn4DtitfvAF8EbkDNXnqhuRLAZMjN1mHuUZD87fBdtsS')
const lemconnTokenMint = new web3.PublicKey('BRPUnNZpzTrjMe6yjU77cf84wDUFYYnqhR4j3NQPfsMs')
const programId = new web3.PublicKey("sEs461DSnSm3m9ssbWZ6j8WXrWJm96owZsAgwVSVKqB")

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

  /* --------------- initialize ------------------------ */
  const initialize = useCallback(async () => {
    console.log('>>>initialize::')
    const [pdaOwnerAccount, bump] = web3.PublicKey.findProgramAddressSync([publicKey.toBuffer(), NATIVE_MINT.toBuffer(), lemconnTokenMint.toBuffer()], program.programId)
    // 创建销售账户（PDA）
    const pdaTokenAccount = await getAssociatedTokenAddress(lemconnTokenMint, pdaOwnerAccount, true)
    const lemconnTokenAccount = await getAssociatedTokenAddress(lemconnTokenMint, publicKey)
    const lemconnFeesAccount = await getAssociatedTokenAddress(NATIVE_MINT, publicKey)

    try {
      const tx = program.instruction.initialize(
        new BN(50000),  // tokenAmount
        new BN(0.001 * web3.LAMPORTS_PER_SOL),  // tokenFees
        1,  // tokenMode  0 按数量计费  1 固定费用
        6,  // tokenDecimal
        bump,  // pdaOwnerBump
        {
          accounts: {
            lemconnOwnerAccount: publicKey,  // 合约管理账户
            lemconnTokenAccount,  // 代币账户
            lemconnTokenMint,
            lemconnFeesAccount,
            lemconnFeesMint: NATIVE_MINT,
            pdaTokenAccount,  // PDA账户
            pdaOwnerAccount,  // PDA 管理账户
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

  /* --------------- claim ------------------- */
  const claim = useCallback(async () => {
    const userTokenAccount = await getAssociatedTokenAddressSync(lemconnTokenMint, publicKey)
    const [pdaOwnerAccount] = web3.PublicKey.findProgramAddressSync([lemconnOwnerAccount.toBuffer(), NATIVE_MINT.toBuffer(), lemconnTokenMint.toBuffer()], program.programId);
    // 创建销售账户（PDA）
    const pdaTokenAccount = await getAssociatedTokenAddress(lemconnTokenMint, pdaOwnerAccount, true)

    const transaction: any = new web3.Transaction()

    // if (!(await accountExists(connection, userTokenAccount))) {
    //   transaction.add(await createATA(publicKey, lemconnTokenMint));
    // }

    transaction.add(await wrapTx(connection, publicKey, 0.00002 * web3.LAMPORTS_PER_SOL * 100));

    transaction.add(program.instruction.claim(
      new BN(100),
      {
        accounts: {
          userOwnerAccount: publicKey,
          userTokenAccount,
          pdaTokenAccount,
          pdaOwnerAccount,
          lemconnOwnerAccount: lemconnOwnerAccount,
          lemconnTokenMint,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
        }
      }
    ))

    transaction.add(await unwrapTx(publicKey))

    const signature = await sendTransaction(transaction, connection, { signers: [], skipPreflight: true })

    console.log('signature', signature)
    console.log('>>>tx::', txUrl(signature))
  }, [publicKey, connection, program, sendTransaction])

  /* --------------- claim2 ------------------- */
  const claim2 = useCallback(async () => {
    const lemconnPublicKey = new web3.PublicKey('BSMGQSBSuShqZGFju3KofkHJsRfUarhJMBG8sJfn6tQk')
    const userTokenAccount = await getAssociatedTokenAddressSync(lemconnTokenMint, publicKey)
    const [lemconnTokenDataPublicKey] = web3.PublicKey.findProgramAddressSync([lemconnTokenMint.toBuffer(), lemconnPublicKey.toBuffer()], program.programId);
    // 创建销售账户（PDA）
    const lemconnPdaAccount = await getAssociatedTokenAddress(lemconnTokenMint, lemconnTokenDataPublicKey, true)

    const lemconnFeesAccount = await getAssociatedTokenAddress(NATIVE_MINT, lemconnPublicKey)

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
          // userFeesAccount: ,  // 用户的
          pdaTokenAccount: lemconnPdaAccount,
          pdaOwnerAccount: lemconnTokenDataPublicKey,
          lemconnFeesAccount,
          lemconnTokenMint,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
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

  /* ---------------- update -------------------- */
  const update = useCallback(async () => {
    console.log('>>>update::')
    const [pdaOwnerAccount] = web3.PublicKey.findProgramAddressSync([publicKey.toBuffer(), NATIVE_MINT.toBuffer(), lemconnTokenMint.toBuffer()], program.programId)
    // 创建销售账户（PDA）
    const pdaTokenAccount = await getAssociatedTokenAddress(lemconnTokenMint, pdaOwnerAccount, true)
    const lemconnTokenAccount = await getAssociatedTokenAddress(lemconnTokenMint, publicKey)

    try {
      const tx = program.instruction.update(
        new BN(0.0002 * web3.LAMPORTS_PER_SOL),  // tokenFees
        0,  // tokenMode
        new BN(100000),  // tokenAmount
        {
          accounts: {
            lemconnOwnerAccount: publicKey,
            lemconnTokenAccount,
            pdaOwnerAccount,
            pdaTokenAccount,
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

  /* ---------------- close ------------------ */
  const close = useCallback(async () => {
    console.log('>>>close::')
    const [pdaOwnerAccount] = web3.PublicKey.findProgramAddressSync([lemconnOwnerAccount.toBuffer(), NATIVE_MINT.toBuffer(), lemconnTokenMint.toBuffer()], program.programId)
    // 创建销售账户（PDA）
    const pdaTokenAccount = await getAssociatedTokenAddress(lemconnTokenMint, pdaOwnerAccount, true)

    const lemconnTokenAccount = await getAssociatedTokenAddressSync(lemconnTokenMint, publicKey)

    try {
      const tx = program.instruction.close(
        {
          accounts: {
            lemconnOwnerAccount: publicKey,
            lemconnTokenAccount,
            lemconnTokenMint,
            pdaOwnerAccount,
            pdaTokenAccount,
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
  
  return (
    <div className="card" title="合约新版本 0530">
      <button onClick={initialize}>initialize</button>
      <button onClick={claim}>claim</button>
      <button onClick={claim2}>claim2</button>
      <button onClick={update}>update</button>
      <button onClick={close}>close</button>
    </div>
  )
}
