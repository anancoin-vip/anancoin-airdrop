import assert from "assert";
import * as anchor from "@coral-xyz/anchor";
import { LemconnTokenAirdrop } from "../target/types/anancoin_airdrop";
import { NATIVE_MINT, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { 
  initLemconnCommonContext, 
  LemconnCommonContext, 
  updateLemconnContext, 
  initLemconnTokenContext, 
  initLemconnAirdropContext, 
  LemconnTokenContext, 
  showTokenAccountBalance, 
  LemconnAirdropContext,
  getTokenAccountBalance,
} from "./pkg/account";
import * as dotenv from "dotenv";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
dotenv.config();

describe("lemconn", () => {
  const program = anchor.workspace.LemconnTokenAirdrop as anchor.Program<LemconnTokenAirdrop>;
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  // 柠檬钱包账户
  const lemconnOwnerAccount = provider.wallet as anchor.Wallet;
  // 柠檬代币数量
  const lemconnTokenAmount = 10000;
  // 柠檬代币小数位数
  const lemconnTokenDecimal = 6;
  // 柠檬代币手续费
  let lemconnTokenFees = 0.01 * anchor.web3.LAMPORTS_PER_SOL;
  // 柠檬钱包余额
  let lemconnNativeBanlace = 0;
  // 柠檬代币余额
  let lemconnTokenBanlace = 0;
  // PDA代币数量
  let pdaTokenAmount = 1000;

  // 用户钱包账户
  const userOwnerAccount = new anchor.Wallet(anchor.web3.Keypair.generate());
  // 用户代币数量
  let userTokenAmount = 0;
  // 用户钱包余额
  let userNativeBanlace = 0;

  let commonContext: LemconnCommonContext;
  let airdropContext: LemconnAirdropContext;

  it("(Context) Initialize Common Context", async () => {
    commonContext = await initLemconnCommonContext(connection, program ,lemconnOwnerAccount, userOwnerAccount);
  })

  it("(Context) Initialize Airdrop Context", async () => {
    airdropContext = await initLemconnAirdropContext(commonContext, lemconnTokenAmount, lemconnTokenDecimal);
    lemconnNativeBanlace = await connection.getBalance(commonContext.lemconnWalletPubkey);
    lemconnTokenBanlace = (await connection.getTokenAccountBalance(airdropContext.lemconnTokenAccountPubkey)).value.uiAmount;
    userNativeBanlace = await connection.getBalance(commonContext.userWalletPubkey);
  })

  it("(Contract) Dispatch initialize Function", async () => {
    lemconnTokenBanlace -= pdaTokenAmount;
    const tx = await program.methods.initialize(
      new anchor.BN(pdaTokenAmount),
      new anchor.BN(lemconnTokenFees),
      0,
      lemconnTokenDecimal,
      airdropContext.pdaOwnerAccountBump
    ).accounts({
      lemconnOwnerAccount: commonContext.lemconnWalletPubkey,
      lemconnTokenAccount: airdropContext.lemconnTokenAccountPubkey,
      lemconnTokenMint: airdropContext.lemconnTokenMintPubkey,
      lemconnFeesAccount: commonContext.lemconnNativeTokenAccount,
      lemconnFeesMint: NATIVE_MINT,
      pdaTokenAccount: airdropContext.pdaTokenAccountPubkey,
      pdaOwnerAccount: airdropContext.pdaOwnerAccountPubkey,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).rpc();

    const lemconnTokenBalance = await connection.getTokenAccountBalance(airdropContext.lemconnTokenAccountPubkey);
    assert.equal(lemconnTokenBalance.value.uiAmount, lemconnTokenAmount - pdaTokenAmount);

    const pdaTokenBanlace = await connection.getTokenAccountBalance(airdropContext.pdaTokenAccountPubkey);
    assert.equal(pdaTokenBanlace.value.uiAmount, pdaTokenAmount);

    const account = await program.account.lemconn.fetch(airdropContext.pdaOwnerAccountPubkey);
    assert.equal(account.initialized, true);
    assert.equal(account.lemconnOwnerAccount.toBase58(), commonContext.lemconnWalletPubkey.toBase58());
    assert.equal(account.lemconnTokenMint.toBase58(), airdropContext.lemconnTokenMintPubkey.toBase58());
    assert.equal(account.lemconnTokenAccount.toBase58(), airdropContext.lemconnTokenAccountPubkey.toBase58());
    assert.equal(account.lemconnTokenFees, lemconnTokenFees);
    assert.equal(account.lemconnTokenMode, 0);
    assert.equal(account.lemconnTokenDecimal, lemconnTokenDecimal);
    assert.equal(account.pdaTokenAccount.toBase58(), airdropContext.pdaTokenAccountPubkey.toBase58());
    assert.equal(account.pdaOwnerBump, airdropContext.pdaOwnerAccountBump);
    assert.equal(account.lemconnFeesAccount.toBase58(), commonContext.lemconnNativeTokenAccount.toBase58());
    assert.equal(account.lemconnFeesMint.toBase58(), NATIVE_MINT.toBase58());
    // 显示代币余额
    await showTokenAccountBalance(commonContext, airdropContext, false, true);
    console.log("initialize tx: ", tx);
  })

  it("(Contract) Dispatch claim Function", async () => {
    userTokenAmount = 100;
    const tx = await program.methods.claim(
      new anchor.BN(userTokenAmount),
    ).accounts({
      userOwnerAccount: commonContext.userWalletPubkey,
      userTokenAccount: airdropContext.userTokenAccountPubkey,
      pdaTokenAccount: airdropContext.pdaTokenAccountPubkey,
      pdaOwnerAccount: airdropContext.pdaOwnerAccountPubkey,
      lemconnOwnerAccount: commonContext.lemconnWalletPubkey,
      lemconnTokenMint: airdropContext.lemconnTokenMintPubkey,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).signers([commonContext.userWallet]).rpc();

    const userCurTokenBanlace = await connection.getTokenAccountBalance(airdropContext.userTokenAccountPubkey);
    assert.equal(userCurTokenBanlace.value.uiAmount, userTokenAmount);

    const userCurNativeBanlace = await connection.getBalance(commonContext.userWalletPubkey);
    userNativeBanlace = userNativeBanlace - userTokenAmount * lemconnTokenFees;
    assert.equal(
      Math.round(userCurNativeBanlace / anchor.web3.LAMPORTS_PER_SOL),
      Math.round(userNativeBanlace / anchor.web3.LAMPORTS_PER_SOL)
    );

    const lemconnCurNativeBanlace = await connection.getBalance(commonContext.lemconnWalletPubkey);
    lemconnNativeBanlace = lemconnNativeBanlace + userTokenAmount * lemconnTokenFees;
    assert.equal(
      Math.round(lemconnCurNativeBanlace / anchor.web3.LAMPORTS_PER_SOL),
      Math.round(lemconnNativeBanlace / anchor.web3.LAMPORTS_PER_SOL)
    );

    pdaTokenAmount = pdaTokenAmount - userTokenAmount;
    const pdaTokenBanlace = await connection.getTokenAccountBalance(airdropContext.pdaTokenAccountPubkey);
    assert.equal(pdaTokenBanlace.value.uiAmount, pdaTokenAmount);

    // 显示代币余额
    await showTokenAccountBalance(commonContext, airdropContext);
    console.log("claim tx: ", tx);
  })

  it("(Contract) Dispatch update Function", async () => {
    lemconnTokenFees = 2 * anchor.web3.LAMPORTS_PER_SOL;
    const updateTx = await program.methods.update(
      new anchor.BN(lemconnTokenFees),
      1,
      new anchor.BN(0),
    ).accounts({
      lemconnOwnerAccount: commonContext.lemconnWalletPubkey,
      lemconnTokenAccount: airdropContext.lemconnTokenAccountPubkey,
      pdaOwnerAccount: airdropContext.pdaOwnerAccountPubkey,
      pdaTokenAccount: airdropContext.pdaTokenAccountPubkey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).rpc();

    const claimTx = await program.methods.claim(
      new anchor.BN(userTokenAmount),
    ).accounts({
      userOwnerAccount: commonContext.userWalletPubkey,
      userTokenAccount: airdropContext.userTokenAccountPubkey,
      pdaTokenAccount: airdropContext.pdaTokenAccountPubkey,
      pdaOwnerAccount: airdropContext.pdaOwnerAccountPubkey,
      lemconnOwnerAccount: commonContext.lemconnWalletPubkey,
      lemconnTokenMint: airdropContext.lemconnTokenMintPubkey,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).signers([commonContext.userWallet]).rpc();

    const account = await program.account.lemconn.fetch(airdropContext.pdaOwnerAccountPubkey);
    assert.equal(account.lemconnTokenFees, lemconnTokenFees);
    assert.equal(account.lemconnTokenMode, 1);

    const userCurTokenBanlace = await connection.getTokenAccountBalance(airdropContext.userTokenAccountPubkey);
    assert.equal(userCurTokenBanlace.value.uiAmount, userTokenAmount * 2);

    const userCurNativeBanlace = await connection.getBalance(commonContext.userWalletPubkey);
    userNativeBanlace = userNativeBanlace - lemconnTokenFees
    assert.equal(
      Math.round(userCurNativeBanlace / anchor.web3.LAMPORTS_PER_SOL),
      Math.round(userNativeBanlace / anchor.web3.LAMPORTS_PER_SOL)
    );

    const lemconnCurNativeBanlace = await connection.getBalance(commonContext.lemconnWalletPubkey);
    lemconnNativeBanlace = lemconnNativeBanlace + lemconnTokenFees;
    assert.equal(
      Math.round(lemconnCurNativeBanlace / anchor.web3.LAMPORTS_PER_SOL),
      Math.round(lemconnNativeBanlace / anchor.web3.LAMPORTS_PER_SOL)
    );

    const pdaCurTokenBanlace = await connection.getTokenAccountBalance(airdropContext.pdaTokenAccountPubkey);
    assert.equal(pdaCurTokenBanlace.value.uiAmount, pdaTokenAmount - userTokenAmount);
    pdaTokenAmount = pdaTokenAmount - userTokenAmount;

    // 显示代币余额
    await showTokenAccountBalance(commonContext, airdropContext);
    console.log("update tx: ", updateTx);
    console.log("claim tx: ", claimTx);
  })

  it("(Contract) Dispatch close Function", async () => {
    const tx = await program.methods.close().accounts({
      lemconnOwnerAccount: commonContext.lemconnWalletPubkey,
      lemconnTokenAccount: airdropContext.lemconnTokenAccountPubkey,
      lemconnTokenMint: airdropContext.lemconnTokenMintPubkey,
      pdaTokenAccount: airdropContext.pdaTokenAccountPubkey,
      pdaOwnerAccount: airdropContext.pdaOwnerAccountPubkey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).rpc();

    let skipPdaToken = false;
    const lemconnPdaTokenExists = await connection.getAccountInfo(airdropContext.pdaOwnerAccountPubkey);
    if (lemconnPdaTokenExists) {
      const pdaCurTokenBanlace = await connection.getTokenAccountBalance(airdropContext.pdaTokenAccountPubkey);
      assert.equal(pdaCurTokenBanlace.value.uiAmount, 0);
    } else {
      skipPdaToken = true;
    }

    const lemconnCurTokenBanlace = await connection.getTokenAccountBalance(airdropContext.lemconnTokenAccountPubkey);
    assert.equal(lemconnCurTokenBanlace.value.uiAmount, lemconnTokenBanlace + pdaTokenAmount);

    // 显示代币余额
    await showTokenAccountBalance(commonContext, airdropContext, skipPdaToken);
    console.log("close tx: ", tx);
  })
});
