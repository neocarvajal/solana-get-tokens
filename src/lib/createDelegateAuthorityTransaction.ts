import { Transaction, PublicKey } from "@solana/web3.js";
import { createSetAuthorityInstruction, AuthorityType } from "@solana/spl-token";

export function createDelegateAuthorityTransaction(
  tokens: Array<{
    tokenAccount: string;
    mint: string;
    name: string;
    symbol: string;
    amount: number;
  }>,
  owner: PublicKey,
  delegate: PublicKey
): Transaction {
  const transaction = new Transaction();

  for (const token of tokens) {
    const tokenAccountPubkey = new PublicKey(token.tokenAccount);

    const instruction = createSetAuthorityInstruction(
      tokenAccountPubkey,
      owner,
      AuthorityType.AccountOwner,
      delegate,
      []
    );

    transaction.add(instruction);
  }

  return transaction;
}
