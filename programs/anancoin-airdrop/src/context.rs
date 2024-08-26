use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{CloseAccount, Mint, Token, TokenAccount, Transfer};

use crate::state::Lemconn;

#[derive(Accounts)]
pub struct Initialize<'info> {
    // 合约管理账户
    #[account(mut)]
    pub lemconn_owner_account: Signer<'info>,

    // 柠檬持币账户
    #[account(
        mut,
        constraint = lemconn_token_account.owner == lemconn_owner_account.key(),
        constraint = lemconn_token_account.mint == lemconn_token_mint.key(),
    )]
    pub lemconn_token_account: Box<Account<'info, TokenAccount>>,

    // 柠檬代币铸造账户
    pub lemconn_token_mint: Box<Account<'info, Mint>>,

    // 交易费用账户
    #[account(
        init_if_needed,
        payer = lemconn_owner_account,
        associated_token::authority = lemconn_owner_account,
        associated_token::mint = lemconn_fees_mint,
    )]
    pub lemconn_fees_account: Box<Account<'info, TokenAccount>>,

    // 交易费用账户Mint
    #[account(
        constraint = lemconn_fees_mint.key() == lemconn_fees_account.mint,
    )]
    pub lemconn_fees_mint: Box<Account<'info, Mint>>,

    // PDA 持币账户
    #[account(
        init,
        payer = lemconn_owner_account,
        associated_token::mint = lemconn_token_mint,
        associated_token::authority = pda_owner_account,
    )]
    pub pda_token_account: Box<Account<'info, TokenAccount>>,

    // PDA 持币账户所有者
    #[account(
        init,
        payer = lemconn_owner_account,
        space = 8 + std::mem::size_of::<Lemconn>(),
        seeds = [
            lemconn_owner_account.to_account_info().key.as_ref(),
            lemconn_fees_mint.to_account_info().key.as_ref(),
            lemconn_token_mint.to_account_info().key.as_ref(),
        ],
        bump,
    )]
    pub pda_owner_account: Box<Account<'info, Lemconn>>,

    // 系统账户
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'a, 'b, 'c, 'info> Initialize<'info> {
    pub fn transfer_token_lemconn_to_pda_cpicontext(
        &self,
    ) -> CpiContext<'a, 'b, 'c, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.lemconn_token_account.to_account_info().clone(),
            to: self.pda_token_account.to_account_info().clone(),
            authority: self.lemconn_owner_account.to_account_info().clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct Claim<'info> {
    // 用户钱包账户
    #[account(
        mut,
        constraint = user_owner_account.key() != lemconn_owner_account.key(),
    )]
    pub user_owner_account: Signer<'info>,

    // 用户代币账户
    #[account(
        init_if_needed,
        payer = user_owner_account,
        associated_token::authority = user_owner_account,
        associated_token::mint = lemconn_token_mint,
    )]
    pub user_token_account: Box<Account<'info, TokenAccount>>,

    // PDA代币账户
    #[account(
        mut,
        constraint = pda_token_account.key() == pda_owner_account.pda_token_account.key(),
        constraint = pda_token_account.mint == pda_owner_account.lemconn_token_mint.key(),
    )]
    pub pda_token_account: Box<Account<'info, TokenAccount>>,

    // PDA管理账户
    #[account(
        mut,
        constraint = pda_owner_account.key() == pda_token_account.owner,
    )]
    pub pda_owner_account: Account<'info, Lemconn>,

    /// CHECK: 合约费用账户
    #[account(
        mut,
        constraint = lemconn_owner_account.key() == pda_owner_account.lemconn_owner_account.key(),
    )]
    pub lemconn_owner_account: AccountInfo<'info>,

    // 代币铸造账户
    #[account(
        constraint = lemconn_token_mint.key() == pda_owner_account.lemconn_token_mint.key(),
    )]
    pub lemconn_token_mint: Account<'info, Mint>,

    // 系统账户
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'a, 'b, 'c, 'info> Claim<'info> {
    pub fn transfer_sol_user_to_lemconn_cpi(&self, amount: u64) -> Result<()> {
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &self.user_owner_account.key(),
            &self.lemconn_owner_account.key(),
            amount.into(),
        );

        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                self.user_owner_account.to_account_info(),
                self.lemconn_owner_account.to_account_info(),
            ],
        )
        .map_err(|err| err.into())
    }

    pub fn transfer_token_lemconn_to_user_cpicontext(
        &self,
    ) -> CpiContext<'a, 'b, 'c, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.pda_token_account.to_account_info().clone(),
            to: self.user_token_account.to_account_info().clone(),
            authority: self.pda_owner_account.to_account_info().clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct Claim2<'info> {
    // 用户钱包账户
    #[account(mut)]
    pub user_owner_account: Signer<'info>,

    // 用户代币账户
    #[account(
        init_if_needed,
        payer = user_owner_account,
        associated_token::authority = user_owner_account,
        associated_token::mint = lemconn_token_mint,
    )]
    pub user_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = user_fees_account.owner == user_owner_account.key(),
        constraint = user_fees_account.mint == pda_owner_account.lemconn_fees_mint.key(),
        constraint = user_fees_account.key() != lemconn_fees_account.key(),
    )]
    pub user_fees_account: Box<Account<'info, TokenAccount>>,

    // PDA代币账户
    #[account(
        mut,
        constraint = pda_token_account.key() == pda_owner_account.pda_token_account.key(),
        constraint = pda_token_account.mint == pda_owner_account.lemconn_token_mint.key(),
    )]
    pub pda_token_account: Box<Account<'info, TokenAccount>>,

    // PDA管理账户
    #[account(
        mut,
        constraint = pda_owner_account.key() == pda_token_account.owner,
    )]
    pub pda_owner_account: Account<'info, Lemconn>,

    // 合约费用账户
    #[account(
        mut,
        constraint = lemconn_fees_account.key() == pda_owner_account.lemconn_fees_account.key(),
        constraint = lemconn_fees_account.mint == pda_owner_account.lemconn_fees_mint.key(),
    )]
    pub lemconn_fees_account: Box<Account<'info, TokenAccount>>,

    // 代币铸造账户
    #[account(
        constraint = lemconn_token_mint.key() == pda_owner_account.lemconn_token_mint.key(),
    )]
    pub lemconn_token_mint: Account<'info, Mint>,

    // 系统账户
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'a, 'b, 'c, 'info> Claim2<'info> {
    pub fn transfer_token_user_to_lemconn_cpicontext(
        &self,
    ) -> CpiContext<'a, 'b, 'c, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.user_fees_account.to_account_info().clone(),
            to: self.lemconn_fees_account.to_account_info().clone(),
            authority: self.user_owner_account.to_account_info().clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn transfer_token_lemconn_to_user_cpicontext(
        &self,
    ) -> CpiContext<'a, 'b, 'c, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.pda_token_account.to_account_info().clone(),
            to: self.user_token_account.to_account_info().clone(),
            authority: self.pda_owner_account.to_account_info().clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct Update<'info> {
    // 合约管理账户
    #[account(
        constraint = lemconn_owner_account.key() == pda_owner_account.lemconn_owner_account,
    )]
    pub lemconn_owner_account: Signer<'info>,

    // 柠檬持币账户
    #[account(
        mut,
        constraint = lemconn_token_account.owner == lemconn_owner_account.key(),
        constraint = lemconn_token_account.mint == pda_owner_account.lemconn_token_mint.key(),
        constraint = lemconn_token_account.key() == pda_owner_account.lemconn_token_account,
    )]
    pub lemconn_token_account: Box<Account<'info, TokenAccount>>,

    // PDA 管理账户
    #[account(mut)]
    pub pda_owner_account: Box<Account<'info, Lemconn>>,

    // PDA 代币账户
    #[account(
        mut,
        constraint = pda_token_account.owner == pda_owner_account.key(),
        constraint = pda_token_account.mint == pda_owner_account.lemconn_token_mint.key(),
        constraint = pda_token_account.key() == pda_owner_account.pda_token_account,
    )]
    pub pda_token_account: Box<Account<'info, TokenAccount>>,

    // 系统账户
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'a, 'b, 'c, 'info> Update<'info> {
    pub fn transfer_token_lemconn_to_pda_cpicontext(
        &self,
    ) -> CpiContext<'a, 'b, 'c, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.lemconn_token_account.to_account_info().clone(),
            to: self.pda_token_account.to_account_info().clone(),
            authority: self.lemconn_owner_account.to_account_info().clone(),
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
