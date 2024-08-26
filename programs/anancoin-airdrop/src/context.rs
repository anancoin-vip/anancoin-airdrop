use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{CloseAccount, Mint, Token, TokenAccount, Transfer};

use crate::state::Config;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = token_account.owner == authority.key(),
        constraint = token_account.mint == token_mint.key(),
    )]
    pub token_account: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = token_mint,
        associated_token::authority = config,
    )]
    pub token_pda: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + std::mem::size_of::<Config>(),
        seeds = [
            authority.to_account_info().key.as_ref(),
            token_mint.to_account_info().key.as_ref(),
        ],
        bump,
    )]
    pub config: Box<Account<'info, Config>>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'a, 'b, 'c, 'info> Initialize<'info> {
    pub fn transfer_token_to_pda_cpicontext(
        &self,
    ) -> CpiContext<'a, 'b, 'c, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.token_account.to_account_info().clone(),
            to: self.token_pda.to_account_info().clone(),
            authority: self.authority.to_account_info().clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        constraint = token_mint.key() == config.token_mint.key(),
    )]
    pub token_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::authority = user,
        associated_token::mint = token_mint,
    )]
    pub token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = pda_account.owner == config.authority,
        constraint = pda_account.mint == token_mint.key(),
    )]
    pub pda_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = config.authority == config.authority,
    )]
    pub config: Account<'info, Config>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'a, 'b, 'c, 'info> Claim<'info> {
    pub fn transfer_token_to_user_cpicontext(
        &self,
    ) -> CpiContext<'a, 'b, 'c, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.pda_account.to_account_info().clone(),
            to: self.token_account.to_account_info().clone(),
            authority: self.config.to_account_info().clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct Close<'info> {
    // 合约管理账户
    #[account(
        mut,
        constraint = lemconn_owner_account.key() == pda_owner_account.lemconn_owner_account,
    )]
    pub lemconn_owner_account: Signer<'info>,

    // 柠檬持币账户
    #[account(
        mut,
        constraint = lemconn_token_account.owner == lemconn_owner_account.key(),
        constraint = lemconn_token_account.mint == lemconn_token_mint.key(),
        constraint = lemconn_token_account.key() == pda_owner_account.lemconn_token_account,
    )]
    pub lemconn_token_account: Box<Account<'info, TokenAccount>>,

    // 代币铸造账户
    #[account(
        constraint = lemconn_token_mint.key() == pda_owner_account.lemconn_token_mint,
    )]
    pub lemconn_token_mint: Account<'info, Mint>,

    // 合约数据及签名账户
    #[account(mut)]
    pub pda_owner_account: Box<Account<'info, Lemconn>>,

    // PDA 持币账户
    #[account(
        mut,
        constraint = pda_token_account.owner == pda_owner_account.key(),
        constraint = pda_token_account.mint == lemconn_token_mint.key(),
        constraint = pda_token_account.key() == pda_owner_account.pda_token_account,
    )]
    pub pda_token_account: Box<Account<'info, TokenAccount>>,

    // 系统用户
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'a, 'b, 'c, 'info> Close<'info> {
    pub fn transfer_token_pda_to_lemconn_cpicontext(
        &self,
    ) -> CpiContext<'a, 'b, 'c, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.pda_token_account.to_account_info().clone(),
            to: self.lemconn_token_account.to_account_info().clone(),
            authority: self.pda_owner_account.to_account_info().clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn close_pda_token_account_cpicontext(
        &self,
    ) -> CpiContext<'a, 'b, 'c, 'info, CloseAccount<'info>> {
        let cpi_accounts = CloseAccount {
            account: self.pda_token_account.to_account_info().clone(),
            destination: self.lemconn_token_account.to_account_info().clone(),
            authority: self.pda_owner_account.to_account_info().clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}
