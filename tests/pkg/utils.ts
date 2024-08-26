import fs = require("fs");
import * as path from "path";
import * as dotenv from "dotenv";

const envItems = [
    "LEMCONN_OWNER_PUBKEY",
    "LEMCONN_VAULT_PUBKEY",
    "LEMCONN_CONTRACT_PUBKEY",
    "LEMCONN_CONTRACT_BUMP",
    "LEMCONN_TOKEN_MINT",
    "LEMCONN_TOKEN_ACCOUNT",
    "LEMCONN_POOL_ACCOUNT",
    "LEMCONN_POOL_BUMP",
    "LEMCONN_SALE_ACCOUNT",
    "USER_OWNER_ACCOUNT",
    "USER_TOKEN_ACCOUNT",
];

export function updateEnv() {
    dotenv.config();
    const eol = "\n";
    const envContents = envItems.map((item) => {
        const value = process.env[item];
        if (!value) {
            return "";
        }
        return `${item}=${value}`;
    }).join(eol);
    fs.writeFileSync(".env", envContents);
}

export function showEnv() {
    dotenv.config();
    envItems.forEach((item) => {
        const value = process.env[item];
        if (value) {
            console.log(`${item}: ${value}`);
        }
    });
}

export function getUserWalletSecretKey(): Uint8Array{
    const defaultPath = path.join(process.env.HOME!, '.config/solana/wallet/user.json');
    const rawKey = JSON.parse(fs.readFileSync(defaultPath, 'utf-8'));
    return Uint8Array.from(rawKey);
}

export function getTokenAmount(value: number, decimals: number) {
    return value * Math.pow(10, decimals);
}