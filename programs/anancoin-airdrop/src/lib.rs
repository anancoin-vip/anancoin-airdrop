pub mod context;
pub mod error;
pub mod state;

use anchor_lang::prelude::*;
use anchor_spl::token::{close_account, transfer};

use crate::context::*;
use crate::error::ErrorCode;

declare_id!("sEs461DSnSm3m9ssbWZ6j8WXrWJm96owZsAgwVSVKqB");

pub const NATIVE_MINT: Pubkey = pubkey!("So11111111111111111111111111111111111111112");

#[program]
pub mod anancoin_airdrop {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        token_amount: u64,
        token_fees: u64,
        token_mode: u8,
        token_decimal: u8,
        pda_owner_bump: u8,
    ) -> Result<()> {
        let pda_owner_account = &mut ctx.accounts.pda_owner_account;
        require!(
            !pda_owner_account.initialized,
            ErrorCode::ContractInitialized
        );
        pda_owner_account.initialized = true;
        pda_owner_account.lemconn_owner_account = *ctx.accounts.lemconn_owner_account.key;
        pda_owner_account.lemconn_token_account = ctx.accounts.lemconn_token_account.key();
        pda_owner_account.lemconn_token_mint = ctx.accounts.lemconn_token_mint.key();
        pda_owner_account.lemconn_token_fees = token_fees;
        pda_owner_account.lemconn_token_mode = token_mode;
        pda_owner_account.lemconn_token_decimal = token_decimal;
        pda_owner_account.lemconn_fees_account = ctx.accounts.lemconn_fees_account.key();
        pda_owner_account.lemconn_fees_mint = ctx.accounts.lemconn_fees_mint.key();
        pda_owner_account.pda_token_account = ctx.accounts.pda_token_account.key();
        pda_owner_account.pda_owner_bump = pda_owner_bump;

        let lemconn_pay_token = token_amount * 10u64.pow(token_decimal as u32);

        // 转移代币到PDA账户
        transfer(
            ctx.accounts.transfer_token_lemconn_to_pda_cpicontext(),
            lemconn_pay_token.into(),
        )?;

        Ok(())
    }

    // SOL 交易
    pub fn claim(ctx: Context<Claim>, token_amount: u64) -> Result<()> {
        let pda_owner_account = &ctx.accounts.pda_owner_account;
        // 检查合约是否初始化
        require!(
            pda_owner_account.initialized,
            ErrorCode::ContractNotInitialized
        );
        // 检查交易对
        require!(
            pda_owner_account.lemconn_fees_mint == NATIVE_MINT,
            ErrorCode::TransactionPairNotSupported
        );
        // 领取代币数量不能为0
        require!(token_amount > 0, ErrorCode::TokenAmountNotEnough);

        // 计算用户在交易中需要支付的费用
        let user_pay_token: u64;
        if pda_owner_account.lemconn_token_mode == 1 {
            user_pay_token = pda_owner_account.lemconn_token_fees;
        } else {
            user_pay_token = token_amount * pda_owner_account.lemconn_token_fees;
        }

        // 交易费用 (用户到柠檬)
        let user_cur_token = ctx.accounts.user_owner_account.lamports();
        require!(user_cur_token >= user_pay_token, ErrorCode::GasFeeNotEnough);
        ctx.accounts
            .transfer_sol_user_to_lemconn_cpi(user_pay_token.into())?;

        // 计算柠檬在交易中需要支付的代币
        let lemconn_pay_token =
            token_amount * 10u64.pow(pda_owner_account.lemconn_token_decimal as u32);
        let lemconn_cur_token = ctx.accounts.pda_token_account.amount;
        require!(
            lemconn_cur_token >= lemconn_pay_token,
            ErrorCode::TokenAmountNotEnough
        );

        // 代币转账 (柠檬PDA到用户)
        let pda_seeds = &[
            pda_owner_account.lemconn_owner_account.as_ref(),
            pda_owner_account.lemconn_fees_mint.as_ref(),
            pda_owner_account.lemconn_token_mint.as_ref(),
            &[pda_owner_account.pda_owner_bump],
        ];

        transfer(
            ctx.accounts
                .transfer_token_lemconn_to_user_cpicontext()
                .with_signer(&[pda_seeds.as_ref()]),
            lemconn_pay_token.into(),
        )?;

        Ok(())
    }

    // SPL 交易
    pub fn claim2(ctx: Context<Claim2>, token_amount: u64) -> Result<()> {
        let pda_owner_account = &ctx.accounts.pda_owner_account;
        // 检查合约是否初始化
        require!(
            pda_owner_account.initialized,
            ErrorCode::ContractNotInitialized
        );
        // 检查交易对
        require!(
            pda_owner_account.lemconn_fees_mint != NATIVE_MINT,
            ErrorCode::TransactionPairNotSupported
        );
        // 领取代币数量不能为0
        require!(token_amount > 0, ErrorCode::TokenAmountNotEnough);

        // 计算用户在交易中需要支付的费用
        let user_pay_token: u64;
        if pda_owner_account.lemconn_token_mode == 1 {
            user_pay_token = pda_owner_account.lemconn_token_fees;
        } else {
            user_pay_token = token_amount * pda_owner_account.lemconn_token_fees;
        }

        // 交易费用 (用户到柠檬)
        let user_cur_token = ctx.accounts.user_fees_account.amount;
        require!(user_cur_token >= user_cur_token, ErrorCode::GasFeeNotEnough);
        transfer(
            ctx.accounts.transfer_token_user_to_lemconn_cpicontext(),
            user_pay_token.into(),
        )?;

        // 计算柠檬在交易中需要支付的代币
        let lemconn_pay_token =
            token_amount * 10u64.pow(pda_owner_account.lemconn_token_decimal as u32);
        let lemconn_cur_token = ctx.accounts.pda_token_account.amount;
        require!(
            lemconn_cur_token >= lemconn_pay_token,
            ErrorCode::TokenAmountNotEnough
        );

        // 代币转账 (柠檬PDA到用户)
        let pda_seeds = &[
            pda_owner_account.lemconn_owner_account.as_ref(),
            pda_owner_account.lemconn_fees_mint.as_ref(),
            pda_owner_account.lemconn_token_mint.as_ref(),
            &[pda_owner_account.pda_owner_bump],
        ];

        transfer(
            ctx.accounts
                .transfer_token_lemconn_to_user_cpicontext()
                .with_signer(&[pda_seeds.as_ref()]),
            lemconn_pay_token.into(),
        )?;

        Ok(())
    }

    pub fn update(
        ctx: Context<Update>,
        token_fees: u64,
        token_mode: u8,
        token_amount: u64,
    ) -> Result<()> {
        let pda_owner_account = &mut ctx.accounts.pda_owner_account;
        // 检查合约是否初始化
        require!(
            pda_owner_account.initialized,
            ErrorCode::ContractNotInitialized
        );

        // 更新代币交易费用
        pda_owner_account.lemconn_token_fees = token_fees;
        // 更新代币费用模式
        pda_owner_account.lemconn_token_mode = token_mode;

        // 转移代币到PDA账户
        if token_amount > 0 {
            let add_token_account =
                token_amount * 10u64.pow(pda_owner_account.lemconn_token_decimal as u32);
            transfer(
                ctx.accounts.transfer_token_lemconn_to_pda_cpicontext(),
                add_token_account.into(),
            )?;
        }

        Ok(())
    }

    pub fn close(ctx: Context<Close>) -> Result<()> {
        let pda_owner_account = &ctx.accounts.pda_owner_account;

        // PDA 签名种子
        let pda_seeds = &[
            pda_owner_account.lemconn_owner_account.as_ref(),
            pda_owner_account.lemconn_fees_mint.as_ref(),
            pda_owner_account.lemconn_token_mint.as_ref(),
            &[pda_owner_account.pda_owner_bump],
        ];

        // 代币转回
        transfer(
            ctx.accounts
                .transfer_token_pda_to_lemconn_cpicontext()
                .with_signer(&[pda_seeds.as_ref()]),
            ctx.accounts.pda_token_account.amount,
        )?;

        // 关闭销售账户
        close_account(
            ctx.accounts
                .close_pda_token_account_cpicontext()
                .with_signer(&[pda_seeds.as_ref()]),
        )?;

        // 关闭合约账户
        let amount = **ctx
            .accounts
            .pda_owner_account
            .to_account_info()
            .try_borrow_mut_lamports()?;
        let pda_owner = &mut ctx.accounts.pda_owner_account;
        let lemconn_owner = &mut ctx.accounts.lemconn_owner_account;
        **pda_owner.to_account_info().try_borrow_mut_lamports()? -= amount;
        **lemconn_owner.to_account_info().try_borrow_mut_lamports()? += amount;

        Ok(())
    }
}
