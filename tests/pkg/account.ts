import * as anchor from "@coral-xyz/anchor";
import { LemconnTokenAirdrop } from "../../target/types/anancoin_airdrop";
import {
    AccountLayout,
    NATIVE_MINT,
    TOKEN_PROGRAM_ID,
    createMint,
    createWrappedNativeAccount,
    getAssociatedTokenAddress,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    createAssociatedTokenAccountInstruction,
    createSyncNativeInstruction
} from "@solana/spl-token";
import { c } from "vite/dist/node/types.d-aGj9QkWt";
import { use } from "chai";

// 获取WSOL原生代币账户
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

export interface LemconnCommonContext {
    connection: anchor.web3.Connection,
    program: anchor.Program<LemconnTokenAirdrop>,
    lemconnWallet: anchor.web3.Signer,
    lemconnWalletPubkey: anchor.web3.PublicKey,
    lemconnNativeTokenAccount: anchor.web3.PublicKey,
    userWallet: anchor.web3.Signer,
    userWalletPubkey: anchor.web3.PublicKey,
    userNativeTokenAccount: anchor.web3.PublicKey,
}

export async function initLemconnCommonContext(
    connection: anchor.web3.Connection,
    program: anchor.Program<LemconnTokenAirdrop>,
    lemconn: anchor.Wallet,
    user: anchor.Wallet,
): Promise<LemconnCommonContext> {
    // 给柠檬钱包
    const airdropAmount = 10000;
    const wrapAmount = 1000;
    // const lemconnNativeTokenAccount = await getAssociatedTokenAddress(
    const lemconnNativeTokenAccount = await getAssociatedTokenAddress(NATIVE_MINT, lemconn.publicKey);
    // const lemconnNativeTokenAccount = await airdropAndWrapped(connection, lemconn.payer, airdropAmount, wrapAmount);
    const userNativeTokenAccount = await getAssociatedTokenAddress(NATIVE_MINT, user.publicKey);
    // const userNativeTokenAccount = await airdropAndWrapped(connection, user.payer, airdropAmount, wrapAmount);
    await connection.requestAirdrop(lemconn.publicKey, 1000 * anchor.web3.LAMPORTS_PER_SOL);
    await connection.requestAirdrop(user.publicKey, 1000 * anchor.web3.LAMPORTS_PER_SOL);

    // 等待2秒
    // await new Promise((resolve) => setTimeout(resolve, 2000));

    const lemconnBalance = await connection.getBalance(lemconn.publicKey, "confirmed");
    // const lemconnNativeTokenBalance = await connection.getTokenAccountBalance(lemconnNativeTokenAccount, "confirmed");
    const userBalance = await connection.getBalance(user.publicKey, "confirmed");
    // const userNativeTokenBalance = await connection.getTokenAccountBalance(userNativeTokenAccount, "confirmed");

    console.table({
        "柠檬钱包公钥": lemconn.publicKey.toBase58(),
        "柠檬钱包地址 (WSOL)": lemconnNativeTokenAccount.toBase58(),
        // "柠檬钱包余额 (WSOL)": lemconnNativeTokenBalance ? lemconnNativeTokenBalance.value.uiAmount : 0,
        "柠檬钱包余额 (SOL)": lemconnBalance ? (lemconnBalance / anchor.web3.LAMPORTS_PER_SOL) : 0,
        "用户钱包公钥": user.publicKey.toBase58(),
        "用户钱包地址 (WSOL)": userNativeTokenAccount.toBase58(),
        // "用户钱包余额 (WSOL)": userNativeTokenBalance ? userNativeTokenBalance.value.uiAmount : 0,
        "用户钱包余额 (SOL)": userBalance ? (userBalance / anchor.web3.LAMPORTS_PER_SOL) : 0,
    })

    return {
        connection: connection,
        program: program,
        lemconnWallet: lemconn.payer,
        lemconnWalletPubkey: lemconn.publicKey,
        lemconnNativeTokenAccount: lemconnNativeTokenAccount,
        userWallet: user.payer,
        userWalletPubkey: user.publicKey,
        userNativeTokenAccount: userNativeTokenAccount,
    };
}

export interface LemconnAirdropContext {
    lemconnTokenMintPubkey: anchor.web3.PublicKey,
    lemconnTokenAccountPubkey: anchor.web3.PublicKey,
    pdaTokenAccountPubkey: anchor.web3.PublicKey,
    pdaOwnerAccountPubkey: anchor.web3.PublicKey,
    pdaOwnerAccountBump: number,
    userTokenAccountPubkey: anchor.web3.PublicKey,
}

export async function initLemconnAirdropContext(
    context: LemconnCommonContext,
    amount: number,
    decimal: number
): Promise<LemconnAirdropContext> {
    // 创建代币
    const lemconnTokenMint = await createMint(
        context.connection,
        context.lemconnWallet,
        context.lemconnWalletPubkey,
        context.lemconnWalletPubkey,
        decimal
    );

    // 创建代币账户
    const lemconnTokenMasterAccount = await getOrCreateAssociatedTokenAccount(
        context.connection,
        context.lemconnWallet,
        lemconnTokenMint,
        context.lemconnWalletPubkey,
    );

    // 给代币账户充值
    await mintTo(
        context.connection,
        context.lemconnWallet,
        lemconnTokenMint,
        lemconnTokenMasterAccount.address,
        context.lemconnWalletPubkey,
        amount * Math.pow(10, decimal)
    );

    // 创建PDA管理账户
    const [pdaOwnerAccountPubkey, pdaOwnerAccountBump] = anchor.web3.PublicKey.findProgramAddressSync(
        [
            context.lemconnWalletPubkey.toBuffer(),
            NATIVE_MINT.toBuffer(),
            lemconnTokenMint.toBuffer()
        ], context.program.programId);

    // 创建PDA代币账户
    const pdaTokenAccountPubkey = await getAssociatedTokenAddress(
        lemconnTokenMint,
        pdaOwnerAccountPubkey,
        true
    );

    // 创建用户代币账户（发起合约调用后合约中创建）
    const userTokenAccountPubkey = await getAssociatedTokenAddress(
        lemconnTokenMint,
        context.userWalletPubkey,
    );
    // 创建用户代币账户（发起合约调用前代码中创建）
    // const userTokenAccountPubkey = await getOrCreateAssociatedTokenAccount(
    //     context.connection,
    //     context.userWallet,
    //     lemconnTokenMint,
    //     context.userWalletPubkey,
    // );

    let lemconnTokenMasterBalance = await context.connection.getTokenAccountBalance(lemconnTokenMasterAccount.address);

    console.table({
        "柠檬代币公钥": lemconnTokenMint.toBase58(),
        "柠檬代币发行量": lemconnTokenMasterBalance.value.uiAmount,
        "柠檬代币账户": lemconnTokenMasterAccount.address.toBase58(),
        "PDA代币账户": pdaTokenAccountPubkey.toBase58(),
        "PDA管理账户": pdaOwnerAccountPubkey.toBase58(),
        "PDA管理Bump": pdaOwnerAccountBump,
        "用户代币账户": userTokenAccountPubkey.toBase58(),
    });

    return {
        lemconnTokenMintPubkey: lemconnTokenMint,
        lemconnTokenAccountPubkey: lemconnTokenMasterAccount.address,
        pdaTokenAccountPubkey: pdaTokenAccountPubkey,
        pdaOwnerAccountPubkey: pdaOwnerAccountPubkey,
        pdaOwnerAccountBump: pdaOwnerAccountBump,
        userTokenAccountPubkey: userTokenAccountPubkey,
    };
}

export interface LemconnTokenContext {
    lemconnAAATokenMintPubkey: anchor.web3.PublicKey,
    lemconnAAATokenMasterPubkey: anchor.web3.PublicKey,
    lemconnAAATokenPdaPubkey: anchor.web3.PublicKey,
    lemconnAAATokenDataPubkey: anchor.web3.PublicKey,
    userAAATokenMasterPubkey: anchor.web3.PublicKey,
    lemconnBBBTokenMintPubkey: anchor.web3.PublicKey,
    lemconnBBBTokenMasterPubkey: anchor.web3.PublicKey,
    lemconnBBBTokenPdaPubkey: anchor.web3.PublicKey,
    lemconnBBBTokenDataPubkey: anchor.web3.PublicKey,
    userBBBTokenMasterPubkey: anchor.web3.PublicKey,
}

export async function initLemconnTokenContext(
    context: LemconnCommonContext,
    contractContext: LemconnAirdropContext,
): Promise<LemconnTokenContext> {
    let lemconnAAATokenMintPubkey = null;
    let lemconnAAATokenMasterPubkey = null;
    let lemconnAAATokenPdaPubkey = null;
    let lemconnAAATokenDataPubkey = null;
    let userAAATokenMasterPubkey = null;
    let lemconnBBBTokenMintPubkey = null;
    let lemconnBBBTokenMasterPubkey = null;
    let lemconnBBBTokenPdaPubkey = null;
    let lemconnBBBTokenDataPubkey = null;
    let userBBBTokenMasterPubkey = null;
    for (let i = 0; i < 2; i++) {
        // 创建代币
        const decimals = 6;
        const lemconnTokenMint = await createMint(
            context.connection,
            context.lemconnWallet,
            context.lemconnWalletPubkey,
            context.lemconnWalletPubkey,
            decimals
        );

        // 创建代币账户
        const lemconnTokenAccount = await getOrCreateAssociatedTokenAccount(
            context.connection,
            context.lemconnWallet,
            lemconnTokenMint,
            context.lemconnWalletPubkey,
        );

        // 给代币账户充值
        const amount = 10000;
        await mintTo(
            context.connection,
            context.lemconnWallet,
            lemconnTokenMint,
            lemconnTokenAccount.address,
            context.lemconnWalletPubkey,
            amount * Math.pow(10, decimals)
        );

        // 创建销售账户（PDA）
        const lemconnPdaAccount = await getAssociatedTokenAddress(
            lemconnTokenMint,
            contractContext.pdaOwnerAccountPubkey,
            true
        );

        // 创建代币数据账户
        const [lemconnTokenDataPublicKey, _] = anchor.web3.PublicKey.findProgramAddressSync(
            [lemconnTokenMint.toBuffer()], context.program.programId);

        // 创建用户代币账户
        const userTokenAccount = await getOrCreateAssociatedTokenAccount(
            context.connection,
            context.userWallet,
            lemconnTokenMint,
            context.userWalletPubkey,
        );

        if (i === 0) {
            lemconnAAATokenMintPubkey = lemconnTokenMint;
            lemconnAAATokenMasterPubkey = lemconnTokenAccount.address;
            lemconnAAATokenPdaPubkey = lemconnPdaAccount;
            lemconnAAATokenDataPubkey = lemconnTokenDataPublicKey;
            userAAATokenMasterPubkey = userTokenAccount.address;
        } else {
            lemconnBBBTokenMintPubkey = lemconnTokenMint;
            lemconnBBBTokenMasterPubkey = lemconnTokenAccount.address;
            lemconnBBBTokenPdaPubkey = lemconnPdaAccount;
            lemconnBBBTokenDataPubkey = lemconnTokenDataPublicKey;
            userBBBTokenMasterPubkey = userTokenAccount.address;
        }
    }

    // 等待2秒
    await new Promise((resolve) => setTimeout(resolve, 2000));
    let lemconnAAATokenMasterBalance = await context.connection.getTokenAccountBalance(lemconnAAATokenMasterPubkey);
    // let lemconnAAATokenPdaBalance = await context.connection.getTokenAccountBalance(lemconnAAATokenPdaPubkey); // PDA此时还未创建
    let lemconnAAATokenPdaBalance = null;
    let userAAATokenMasterBalance = await context.connection.getTokenAccountBalance(userAAATokenMasterPubkey);
    let lemconnBBBTokenMasterBalance = await context.connection.getTokenAccountBalance(lemconnBBBTokenMasterPubkey);
    // let lemconnBBBTokenPdaBalance = await context.connection.getTokenAccountBalance(lemconnBBBTokenPdaPubkey); // PDA此时还未创建
    let lemconnBBBTokenPdaBalance = null;
    let userBBBTokenMasterBalance = await context.connection.getTokenAccountBalance(userBBBTokenMasterPubkey);

    console.table({
        "柠檬代币公钥 (AAA)": lemconnAAATokenMintPubkey.toBase58(),
        "柠檬代币账户 (AAA)": lemconnAAATokenMasterPubkey.toBase58(),
        "柠檬代币PDA (AAA)": lemconnAAATokenPdaPubkey.toBase58(),
        "柠檬代币数据 (AAA)": lemconnAAATokenDataPubkey.toBase58(),
        "用户代币账户 (AAA)": userAAATokenMasterPubkey.toBase58(),
        "柠檬代币余额 (AAA)": lemconnAAATokenMasterBalance ? lemconnAAATokenMasterBalance.value.uiAmount : 0,
        "柠檬代币PDA余额 (AAA)": lemconnAAATokenPdaBalance ? lemconnAAATokenPdaBalance.value.uiAmount : 0,
        "用户代币余额 (AAA)": userAAATokenMasterBalance ? userAAATokenMasterBalance.value.uiAmount : 0,
        "柠檬代币公钥 (BBB)": lemconnBBBTokenMintPubkey.toBase58(),
        "柠檬代币账户 (BBB)": lemconnBBBTokenMasterPubkey.toBase58(),
        "柠檬代币PDA (BBB)": lemconnBBBTokenPdaPubkey.toBase58(),
        "柠檬代币数据 (BBB)": lemconnBBBTokenDataPubkey.toBase58(),
        "用户代币账户 (BBB)": userBBBTokenMasterPubkey.toBase58(),
        "柠檬代币余额 (BBB)": lemconnBBBTokenMasterBalance ? lemconnBBBTokenMasterBalance.value.uiAmount : 0,
        "柠檬代币PDA余额 (BBB)": lemconnBBBTokenPdaBalance ? lemconnBBBTokenPdaBalance.value.uiAmount : 0,
        "用户代币余额 (BBB)": userBBBTokenMasterBalance ? userBBBTokenMasterBalance.value.uiAmount : 0,
    });

    return {
        lemconnAAATokenMintPubkey: lemconnAAATokenMintPubkey,
        lemconnAAATokenMasterPubkey: lemconnAAATokenMasterPubkey,
        lemconnAAATokenPdaPubkey: lemconnAAATokenPdaPubkey,
        lemconnAAATokenDataPubkey: lemconnAAATokenDataPubkey,
        userAAATokenMasterPubkey: userAAATokenMasterPubkey,
        lemconnBBBTokenMintPubkey: lemconnBBBTokenMintPubkey,
        lemconnBBBTokenMasterPubkey: lemconnBBBTokenMasterPubkey,
        lemconnBBBTokenDataPubkey: lemconnBBBTokenDataPubkey,
        lemconnBBBTokenPdaPubkey: lemconnBBBTokenPdaPubkey,
        userBBBTokenMasterPubkey: userBBBTokenMasterPubkey,
    };
}

export async function showTokenAccountBalance(
    context: LemconnCommonContext,
    airdropContext: LemconnAirdropContext,
    spikPda: boolean = false,
    spikUser: boolean = false
): Promise<void> {
    // 等待2秒
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const lemconnBalance = await context.connection.getBalance(context.lemconnWalletPubkey, "confirmed");
    // const lemconnNativeTokenBalance = await context.connection.getTokenAccountBalance(context.lemconnNativeTokenAccount, "confirmed");
    const lemconnSplTokenMasterBalance = await context.connection.getTokenAccountBalance(airdropContext.lemconnTokenAccountPubkey, "confirmed");
    const userBalance = await context.connection.getBalance(context.userWalletPubkey, "confirmed");
    // const userNativeTokenBalance = await context.connection.getTokenAccountBalance(context.userNativeTokenAccount, "confirmed");
    let userSplTokenBalance = null;
    if (spikUser === false) {
        userSplTokenBalance = await context.connection.getTokenAccountBalance(airdropContext.userTokenAccountPubkey, "confirmed");
    } else {
        userSplTokenBalance = {
            value:
            {
                uiAmount: 0,
            },
        };
    }

    let lemconnPanTokenPdaTokenBalance = null;
    if (spikPda === false) {
        lemconnPanTokenPdaTokenBalance = await context.connection.getTokenAccountBalance(airdropContext.pdaTokenAccountPubkey, "confirmed");
    } else {
        lemconnPanTokenPdaTokenBalance = {
            value:
            {
                uiAmount: 0,
            },
        };
    }

    console.table({
        "柠檬代币账户余额（SOL）": lemconnBalance > 0 ? lemconnBalance / anchor.web3.LAMPORTS_PER_SOL : 0,
        "用户代币账户余额（SOL）": userBalance > 0 ? userBalance / anchor.web3.LAMPORTS_PER_SOL : 0,
        // "柠檬代币账户余额（WSOL）": lemconnNativeTokenBalance.value.uiAmount,
        // "用户代币账户余额（WSOL）": userNativeTokenBalance.value.uiAmount,
        "柠檬代币账户余额（SPL）": lemconnSplTokenMasterBalance.value.uiAmount,
        "柠檬代币PDA余额（SPL）": lemconnPanTokenPdaTokenBalance.value.uiAmount,
        "用户代币账户余额（SPL）": userSplTokenBalance.value.uiAmount,
    });
}

export interface LemconnContext {
    connection: anchor.web3.Connection,
    program: anchor.Program<LemconnTokenAirdrop>,
    owner: anchor.web3.Signer,
    user: anchor.web3.Signer,
    lemconnOwnerAccount: anchor.web3.PublicKey,
    lemconnTokenMint: anchor.web3.PublicKey,
    lemconnTokenAccount: anchor.web3.PublicKey,
    lemconnPoolAccount: anchor.web3.PublicKey,
    lemconnPoolBump: number,
    lemconnSaleAccount: anchor.web3.PublicKey,
    userOwnerAccount: anchor.web3.PublicKey,
    userTokenAccount: anchor.web3.PublicKey,
}

export async function initLemconnContext(
    connection: anchor.web3.Connection,
    lemconnPayer: anchor.Wallet,
    userPayer: anchor.Wallet,
    program: anchor.Program<LemconnTokenAirdrop>
): Promise<LemconnContext> {
    const lemconnBalance = await connection.getBalance(lemconnPayer.publicKey, "confirmed");
    // 给柠檬钱包充值
    connection.requestAirdrop(lemconnPayer.publicKey, 1000 * anchor.web3.LAMPORTS_PER_SOL);

    const userBalance = await connection.getBalance(userPayer.publicKey, "confirmed");
    // 给用户钱包充值
    connection.requestAirdrop(userPayer.publicKey, 1000 * anchor.web3.LAMPORTS_PER_SOL);

    // 创建代币
    const decimals = 6;
    const lemconnTokenMint = await createMint(
        connection,
        lemconnPayer.payer,
        lemconnPayer.publicKey,
        lemconnPayer.publicKey,
        decimals
    );

    // 创建代币账户
    const lemconnTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        lemconnPayer.payer,
        lemconnTokenMint,
        lemconnPayer.publicKey,
    );

    // 给代币账户充值
    const amount = 10000;
    await mintTo(
        connection,
        lemconnPayer.payer,
        lemconnTokenMint,
        lemconnTokenAccount.address,
        lemconnPayer.publicKey,
        amount * Math.pow(10, decimals)
    );

    // 创建交易池账户
    const [lemconnPoolAccount, lemconnPoolBump] = anchor.web3.PublicKey.findProgramAddressSync(
        [lemconnTokenMint.toBuffer()], program.programId);


    // 创建销售账户（PDA）
    const lemconnSaleAccount = await getAssociatedTokenAddress(
        lemconnTokenMint,
        lemconnPoolAccount,
        true
    );

    // 创建用户代币账户
    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        userPayer.payer,
        lemconnTokenMint,
        userPayer.publicKey,
    );

    return {
        connection: connection,
        program: program,
        owner: lemconnPayer.payer,
        user: userPayer.payer,
        lemconnOwnerAccount: lemconnPayer.publicKey,
        lemconnTokenMint: lemconnTokenMint,
        lemconnTokenAccount: lemconnTokenAccount.address,
        lemconnPoolAccount: lemconnPoolAccount,
        lemconnPoolBump: lemconnPoolBump,
        lemconnSaleAccount: lemconnSaleAccount,
        userOwnerAccount: userPayer.publicKey,
        userTokenAccount: userTokenAccount.address,
    };
}


export async function updateLemconnContext(
    connection: anchor.web3.Connection,
    program: anchor.Program<LemconnTokenAirdrop>,
    owner: anchor.web3.Signer,
    user: anchor.web3.Signer,
    lemconnOwnerAccount: anchor.web3.PublicKey,
    lemconnTokenMint: anchor.web3.PublicKey,
    lemconnTokenAccount: anchor.web3.PublicKey,
    lemconnPoolAccount: anchor.web3.PublicKey,
    lemconnPoolBump: number,
    lemconnSaleAccount: anchor.web3.PublicKey,
    userOwnerAccount: anchor.web3.PublicKey,
    userTokenAccount: anchor.web3.PublicKey,
): Promise<LemconnContext> {
    return {
        connection: connection,
        program: program,
        owner: owner,
        user: user,
        lemconnOwnerAccount: lemconnOwnerAccount,
        lemconnTokenMint: lemconnTokenMint,
        lemconnTokenAccount: lemconnTokenAccount,
        lemconnPoolAccount: lemconnPoolAccount,
        lemconnPoolBump: lemconnPoolBump,
        lemconnSaleAccount: lemconnSaleAccount,
        userOwnerAccount: userOwnerAccount,
        userTokenAccount: userTokenAccount,
    };
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
