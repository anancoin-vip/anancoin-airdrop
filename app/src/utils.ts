import * as anchor from "@coral-xyz/anchor"
import {
  NATIVE_MINT,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token"

export const cluster = 'devnet'

export const LABELS = {
  'change-wallet': '',
  connecting: 'Connecting ...',
  'copy-address': 'Copy address',
  copied: 'Copied',
  disconnect: 'Disconnect',
  'has-wallet': 'Connect',
  'no-wallet': 'Select Wallet',
}


export const txUrl = (tx: string) => {
  return `https://explorer.solana.com/tx/${tx}?cluster=${cluster}`
}

export const accountExists = async (
  connection: any,
  account: anchor.web3.PublicKey,
  programId: anchor.web3.PublicKey = TOKEN_PROGRAM_ID
): Promise<boolean> => {
  const info = await connection.getAccountInfo(account);
  if(info === null || !info.owner.equals(programId)){
    return false;
  }else{
    return true;
  }
}

export const getATA = async (
  user: anchor.web3.PublicKey,
  mintAccount: anchor.web3.PublicKey
): Promise<anchor.web3.PublicKey> => {
  const tokenAccount = await getAssociatedTokenAddress(
    mintAccount,
    user
  )
  return tokenAccount
}

export const createATA = async (
  user: anchor.web3.PublicKey,
  mintAccount: anchor.web3.PublicKey
): Promise<anchor.web3.Transaction> => {
  const tx = new anchor.web3.Transaction();
  const tokenAccount = await getATA(user, mintAccount);

  tx.add(
    createAssociatedTokenAccountInstruction(
      user,
      tokenAccount,
      user,
      mintAccount,
    )
  );
  return tx;
}

export const wrapTx = async (
  connection: any,
  user: anchor.web3.PublicKey,
  amount: number
): Promise<anchor.web3.Transaction> => {
  const tx = new anchor.web3.Transaction();
  const wsolAccount = await getATA(user, NATIVE_MINT);

  if (!(await accountExists(connection, wsolAccount))) {
    tx.add(await createATA(user, NATIVE_MINT));
  }

  tx.add(
    anchor.web3.SystemProgram.transfer({
      fromPubkey: user,
      toPubkey: wsolAccount,
      lamports: amount,
    })
  );

  //@ts-ignore (@solana/spl-token bug...)
  tx.add(createSyncNativeInstruction(wsolAccount));

  return tx;
};

export const unwrapTx = async (
  user: anchor.web3.PublicKey
): Promise<anchor.web3.Transaction> => {
  const tx = new anchor.web3.Transaction();
  const wsolAccount = await getATA(user, NATIVE_MINT);

  tx.add(
    createCloseAccountInstruction(
      wsolAccount,
      user,
      user,
    )
  );

  return tx;
};
