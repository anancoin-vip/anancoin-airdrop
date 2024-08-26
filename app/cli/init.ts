(() => {
  const anchor = require('@coral-xyz/anchor');
  const LemconnTokenAirdrop = require('../../target/types/anancoin_airdrop');

  const init = () => {
    const program = anchor.workspace.LemconnTokenAirdrop;
    console.log('>>>init::', program);
  }
  init()
})()
