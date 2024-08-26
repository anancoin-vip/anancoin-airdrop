use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("token amount is not enough")]
    TokenAmountNotEnough,
    #[msg("claim token amount is out of limit")]
    ClaimTokenAmountOutOfLimit,
    #[msg("claim token amount is zero")]
    ClaimTokenAmountIsZero,
}
