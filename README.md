# ANAN Token Airdrop Program

This program is the smart contract for the ANAN Token airdrop program.

## Environment Setup
1. Install [Rust](https://www.rust-lang.org/tools/install).
2. Install [Solana](https://docs.solana.com/cli/install-solana-cli-tools) and then run `solana-keygen new` to create a keypair at the default location.
3. install [Anchor](https://book.anchor-lang.com/getting_started/installation.html).

## Quickstart

Clone the repository and enter the source code directory.
```
git clone https://github.com/anancoin/anancoin-airdrop.git
cd anancoin-airdrop
```

Build
```
anchor build
```
After building, the smart contract files are all located in the target directory.

Deploy
```
anchor deploy
```
Attention, check your configuration and confirm the environment you want to deploy.

# License
The source code is licensed under Apache 2.0.