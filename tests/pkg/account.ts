import * as anchor from "@coral-xyz/anchor";
import { AnanCoinAirdrop } from "../../target/types/anancoin_airdrop";
import {
    NATIVE_MINT,
    createMint,
    getAssociatedTokenAddress,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    createAssociatedTokenAccountInstruction,
    createSyncNativeInstruction
} from "@solana/spl-token";

export async function airdropAndWrapped(
    connection: anchor.web3.Connection,
    payer: anchor.web3.Signer,
    amount: number,
    wrapAmount: number
): Promise<anchor.web3.PublicKey> {
    const airdropSignature = await connection.requestAirdrop(
        payer.publicKey,
        amount * anchor.web3.LAMPORTS_PER_SOL,
    );

    await connection.confirmTransaction(airdropSignature);

    const associatedTokenAccount = await getAssociatedTokenAddress(
        NATIVE_MINT,
        payer.publicKey
    );

    const ataTransaction = new anchor.web3.Transaction().add(
        createAssociatedTokenAccountInstruction(
            payer.publicKey,
            associatedTokenAccount,
            payer.publicKey,
            NATIVE_MINT
        )
    );

    await anchor.web3.sendAndConfirmTransaction(connection, ataTransaction, [payer]);

    const solTransferTransaction = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: associatedTokenAccount,
            lamports: wrapAmount * anchor.web3.LAMPORTS_PER_SOL
        }), createSyncNativeInstruction(associatedTokenAccount)
    );

    await anchor.web3.sendAndConfirmTransaction(connection, solTransferTransaction, [payer]);

    return associatedTokenAccount;
}

export interface CommonContext {
    connection: anchor.web3.Connection,
    program: anchor.Program<AnanCoinAirdrop>,
    authorityWallet: anchor.web3.Signer,
    authorityWalletPubkey: anchor.web3.PublicKey,
    authorityNativeTokenAccount: anchor.web3.PublicKey,
    userWallet: anchor.web3.Signer,
    userWalletPubkey: anchor.web3.PublicKey,
    userNativeTokenAccount: anchor.web3.PublicKey,
}

export async function initCommonContext(
    connection: anchor.web3.Connection,
    program: anchor.Program<AnanCoinAirdrop>,
    authority: anchor.Wallet,
    user: anchor.Wallet,
): Promise<CommonContext> {
    const airdropAmount = 10000;
    const wrapAmount = 1000;
    const authorityNativeTokenAccount = await getAssociatedTokenAddress(NATIVE_MINT, authority.publicKey);
    const userNativeTokenAccount = await getAssociatedTokenAddress(NATIVE_MINT, user.publicKey);
    await connection.requestAirdrop(authority.publicKey, 1000 * anchor.web3.LAMPORTS_PER_SOL);
    await connection.requestAirdrop(user.publicKey, 1000 * anchor.web3.LAMPORTS_PER_SOL);

    // sleep 2s
    // await new Promise((resolve) => setTimeout(resolve, 2000));

    const authorityBalance = await connection.getBalance(authority.publicKey, "confirmed");
    const userBalance = await connection.getBalance(user.publicKey, "confirmed");

    console.table({
        "Authority Pubkey": authority.publicKey.toBase58(),
        "Authority (WSOL)": authorityNativeTokenAccount.toBase58(),
        "Authority (SOL)": authorityBalance ? (authorityBalance / anchor.web3.LAMPORTS_PER_SOL) : 0,
        "User Pubkey": user.publicKey.toBase58(),
        "User Pubkey (WSOL)": userNativeTokenAccount.toBase58(),
        "User Pubkey (SOL)": userBalance ? (userBalance / anchor.web3.LAMPORTS_PER_SOL) : 0,
    })

    return {
        connection: connection,
        program: program,
        authorityWallet: authority.payer,
        authorityWalletPubkey: authority.publicKey,
        authorityNativeTokenAccount: authorityNativeTokenAccount,
        userWallet: user.payer,
        userWalletPubkey: user.publicKey,
        userNativeTokenAccount: userNativeTokenAccount,
    };
}

export interface AirdropContext {
    tokenMintPubkey: anchor.web3.PublicKey,
    tokenAccountPubkey: anchor.web3.PublicKey,
    pdaAccountPubkey: anchor.web3.PublicKey,
    configAccountPubkey: anchor.web3.PublicKey,
    configAccountBump: number,
    userAccountPubkey: anchor.web3.PublicKey,
}

export async function initAirdropContext(
    context: CommonContext,
    amount: number,
    decimal: number
): Promise<AirdropContext> {
    const tokenMint = await createMint(
        context.connection,
        context.authorityWallet,
        context.authorityWalletPubkey,
        context.authorityWalletPubkey,
        decimal
    );

    const authorityTokenAccount = await getOrCreateAssociatedTokenAccount(
        context.connection,
        context.authorityWallet,
        tokenMint,
        context.authorityWalletPubkey,
    );

    await mintTo(
        context.connection,
        context.authorityWallet,
        tokenMint,
        authorityTokenAccount.address,
        context.authorityWalletPubkey,
        amount * Math.pow(10, decimal)
    );

    const [configAccountPubkey, configAccountBump] = anchor.web3.PublicKey.findProgramAddressSync(
        [
            context.authorityWalletPubkey.toBuffer(),
            tokenMint.toBuffer()
        ], context.program.programId);

    const pdaTokenAccountPubkey = await getAssociatedTokenAddress(
        tokenMint,
        configAccountPubkey,
        true
    );

    const userTokenAccountPubkey = await getAssociatedTokenAddress(
        tokenMint,
        context.userWalletPubkey,
    );

    let authorityTokenBalance = await context.connection.getTokenAccountBalance(authorityTokenAccount.address);

    console.table({
        "token mint": tokenMint.toBase58(),
        "token supply": authorityTokenAccount.value.uiAmount,
        "token account": authorityTokenAccount.address.toBase58(),
        "pda account": pdaTokenAccountPubkey.toBase58(),
        "config account": configAccountPubkey.toBase58(),
        "config bump": configAccountBump,
        "user account": userTokenAccountPubkey.toBase58(),
    });

    return {
        tokenMintPubkey: tokenMint,
        tokenAccountPubkey: authorityTokenAccount.address,
        pdaAccountPubkey: pdaTokenAccountPubkey,
        configAccountPubkey: configAccountPubkey,
        configAccountBump: configAccountBump,
        userAccountPubkey: userTokenAccountPubkey,
    };
}

export async function showTokenAccountBalance(
    context: CommonContext,
    airdropContext: AirdropContext,
    spikPda: boolean = false,
    spikUser: boolean = false
): Promise<void> {
    // sleep 2s
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const authorityNativeBalance = await context.connection.getBalance(context.authorityWalletPubkey, "confirmed");
    const authorityTokenBalance = await context.connection.getTokenAccountBalance(airdropContext.tokenAccountPubkey, "confirmed");
    const userBalance = await context.connection.getBalance(context.userWalletPubkey, "confirmed");
    let userTokenBalance = null;
    if (spikUser === false) {
        userTokenBalance = await context.connection.getTokenAccountBalance(airdropContext.userAccountPubkey, "confirmed");
    } else {
        userTokenBalance = {
            value:
            {
                uiAmount: 0,
            },
        };
    }

    let pdaTokenBalance = null;
    if (spikPda === false) {
        pdaTokenBalance = await context.connection.getTokenAccountBalance(airdropContext.pdaAccountPubkey, "confirmed");
    } else {
        pdaTokenBalance = {
            value:
            {
                uiAmount: 0,
            },
        };
    }

    console.table({
        "authority (SOL)": authorityNativeBalance > 0 ? authorityNativeBalance / anchor.web3.LAMPORTS_PER_SOL : 0,
        "user (SOL)": userBalance > 0 ? userBalance / anchor.web3.LAMPORTS_PER_SOL : 0,
        "authority (SPL)": authorityTokenBalance.value.uiAmount,
        "pda (SPL)": pdaTokenBalance.value.uiAmount,
        "user (SPL)": userTokenBalance.value.uiAmount,
    });
}

export async function getTokenAccountBalance(account: anchor.web3.PublicKey, connection: anchor.web3.Connection) {
    try {
        const res = await connection.getTokenAccountBalance(account, "confirmed");
        if (res && res.value) return res.value.uiAmount;
        return 0;
    } catch (e) {
        console.log(e);
        return 0;
    }
}
