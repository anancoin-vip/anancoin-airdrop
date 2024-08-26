use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    // 代币数量不足
    #[msg("token amount is not enough")]
    TokenAmountNotEnough,
    // 领取代币超出限制
    #[msg("claim token amount is out of limit")]
    ClaimTokenAmountOutOfLimit,
    // 领取代币为零
    #[msg("claim token amount is zero")]
    ClaimTokenAmountIsZero,
    // SOL 余额不足
    #[msg("gas fee is not enough")]
    GasFeeNotEnough,
    // 错误的账户
    #[msg("account is not correct")]
    AccountNotCorrect,
    // 合约初始化完成
    #[msg("smart contract has been initialized")]
    ContractInitialized,
    // 合约未初始化
    #[msg("smart contract has not been initialized")]
    ContractNotInitialized,
    // 不支持当前交易对
    #[msg("current transaction pair is not supported")]
    TransactionPairNotSupported,
}
