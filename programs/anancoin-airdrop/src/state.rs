
use anchor_lang::prelude::*;

#[account]
pub struct Lemconn {
    pub initialized: bool,
    pub lemconn_owner_account: Pubkey,
    pub lemconn_token_mint: Pubkey,
    pub lemconn_token_account: Pubkey,
    pub lemconn_token_fees: u64,
    pub lemconn_token_mode: u8,
    pub lemconn_token_decimal: u8,
    pub pda_token_account: Pubkey,
    pub pda_owner_bump: u8,
    pub lemconn_fees_mint: Pubkey,
    pub lemconn_fees_account: Pubkey,
}
