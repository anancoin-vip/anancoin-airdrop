
use anchor_lang::prelude::*;

#[account]
pub struct Config {
    pub authority: Pubkey,
    pub bump: u8,
    pub token_mint: Pubkey,
    pub token_account: Pubkey,
    pub token_pda: Pubkey,
    pub token_decimals: u8,
    pub token_limit: u64,
}
