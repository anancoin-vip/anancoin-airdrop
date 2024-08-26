import assert from "assert";
import * as anchor from "@coral-xyz/anchor";
import { AnanCoinAirdrop } from "../target/types/anancoin_airdrop";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { 
  initCommonContext, 
  CommonContext, 
  initAirdropContext, 
  showTokenAccountBalance, 
  AirdropContext,
} from "./pkg/account";
import * as dotenv from "dotenv";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
dotenv.config();

describe("anancoin", () => {
  const program = anchor.workspace.AnanCoinAirdrop as anchor.Program<AnanCoinAirdrop>;
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;

  const authorityWallet = provider.wallet as anchor.Wallet;
  let authorityNativeBanlace = 0;
  let authorityTokenBanlace = 0;

  const userWallet = new anchor.Wallet(anchor.web3.Keypair.generate());
  let userTokenBanlace = 0;
  let userNativeBanlace = 0;

  const tokenAmount = 10000;
  const tokenDecimals = 6;
  const tokenLimit = 100;

  let pdaTokenBanlace = 1000;

  let commonContext: CommonContext;
  let airdropContext: AirdropContext;

  it("(Context) Initialize Common Context", async () => {
    commonContext = await initCommonContext(connection, program ,authorityWallet, userWallet);
  })

  it("(Context) Initialize Airdrop Context", async () => {
    airdropContext = await initAirdropContext(commonContext, tokenAmount, tokenDecimals);
    authorityNativeBanlace = await connection.getBalance(commonContext.authorityWalletPubkey);
    authorityTokenBanlace = (await connection.getTokenAccountBalance(airdropContext.tokenAccountPubkey)).value.uiAmount;
    userNativeBanlace = await connection.getBalance(commonContext.userWalletPubkey);
  })

  it("(Contract) Dispatch initialize Function", async () => {
    authorityTokenBanlace -= pdaTokenBanlace;
    const tx = await program.methods.initialize(
      new anchor.BN(pdaTokenBanlace),
      tokenDecimals,
      tokenLimit,
      airdropContext.configAccountBump
    ).accounts({
      authority: commonContext.authorityWalletPubkey,
      tokenAccount: airdropContext.tokenAccountPubkey,
      tokenMint: airdropContext.tokenMintPubkey,
      tokenPda: airdropContext.pdaAccountPubkey,
      config: airdropContext.configAccountPubkey,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).rpc();

    const curAuthorityTokenBanlace = await connection.getTokenAccountBalance(airdropContext.tokenAccountPubkey);
    assert.equal(curAuthorityTokenBanlace.value.uiAmount, authorityTokenBanlace);

    const curPdaTokenBanlace = await connection.getTokenAccountBalance(airdropContext.pdaAccountPubkey);
    assert.equal(curPdaTokenBanlace.value.uiAmount, pdaTokenBanlace);

    const config = await program.account.config.fetch(airdropContext.configAccountPubkey);
    assert.equal(config.authority.toBase58(), commonContext.authorityWalletPubkey.toBase58());
    assert.equal(config.tokenMint.toBase58(), airdropContext.tokenMintPubkey.toBase58());
    assert.equal(config.tokenAccount.toBase58(), airdropContext.tokenAccountPubkey.toBase58());
    assert.equal(config.tokenPda.toBase58(), airdropContext.pdaAccountPubkey.toBase58());
    assert.equal(config.tokenDecimals, tokenDecimals);
    assert.equal(config.tokenLimit, tokenLimit);
    assert.equal(config.bump, airdropContext.configAccountBump);
    await showTokenAccountBalance(commonContext, airdropContext, false, true);
    console.log("initialize tx: ", tx);
  })

  it("(Contract) Dispatch claim Function", async () => {
    userTokenBanlace = 100;
    const tx = await program.methods.claim(
      new anchor.BN(userTokenBanlace),
    ).accounts({
      user: commonContext.userWalletPubkey,
      tokenAccount: airdropContext.userAccountPubkey,
      tokenMint: airdropContext.tokenMintPubkey,
      pdaAccount: airdropContext.pdaAccountPubkey,
      config: airdropContext.configAccountPubkey,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).signers([commonContext.userWallet]).rpc();

    const curUserTokenBanlace = await connection.getTokenAccountBalance(airdropContext.userAccountPubkey);
    assert.equal(curUserTokenBanlace.value.uiAmount, userTokenBanlace);

    pdaTokenBanlace -= userTokenBanlace;
    const curPdaTokenBanlace = await connection.getTokenAccountBalance(airdropContext.pdaAccountPubkey);
    assert.equal(curPdaTokenBanlace.value.uiAmount, pdaTokenBanlace);

    await showTokenAccountBalance(commonContext, airdropContext);
    console.log("claim tx: ", tx);
  })

  it("(Contract) Dispatch close Function", async () => {
    const tx = await program.methods.close().accounts({
      authority: commonContext.authorityWalletPubkey,
      tokenAccount: airdropContext.tokenAccountPubkey,
      tokenMint: airdropContext.tokenMintPubkey,
      pdaAccount: airdropContext.pdaAccountPubkey,
      config: airdropContext.configAccountPubkey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).rpc();

    let skipPdaToken = false;
    const pdaTokenExists = await connection.getAccountInfo(airdropContext.pdaAccountPubkey);
    if (pdaTokenExists) {
      const pdaCurTokenBanlace = await connection.getTokenAccountBalance(airdropContext.pdaAccountPubkey);
      assert.equal(pdaCurTokenBanlace.value.uiAmount, 0);
    } else {
      skipPdaToken = true;
    }

    const authorityCurTokenBanlace = await connection.getTokenAccountBalance(airdropContext.tokenAccountPubkey);
    assert.equal(authorityCurTokenBanlace.value.uiAmount, authorityTokenBanlace + pdaTokenBanlace);

    await showTokenAccountBalance(commonContext, airdropContext, skipPdaToken);
    console.log("close tx: ", tx);
  })
});
