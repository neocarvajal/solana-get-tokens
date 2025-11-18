// https://solana.com/es/developers/cookbook/tokens/get-all-token-accounts
// https://metaplex-foundation.github.io/js/classes/js.NftClient.html#findByMint
// https://github.com/metaplex-foundation/js-examples/blob/main/getting-started-nextjs/pages/index.js

import { AppHero } from "@/components/app-hero";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplTokenMetadata, fetchDigitalAsset } from '@metaplex-foundation/mpl-token-metadata'
import { fromWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters';

const RPC_URL = "https://api.mainnet-beta.solana.com";
const OWNER_ADDRESS = new PublicKey("8H8nCS6JUhKNJRHbC2fmr6ofHRLsYCapqVmb5CJJ6VE6");
const umi = createUmi(RPC_URL).use(mplTokenMetadata());

const getTokenMetadata = async (mintPublicKey: PublicKey) => {
  const umiPublicKey = fromWeb3JsPublicKey(mintPublicKey);
  const digitalAsset = await fetchDigitalAsset(umi, umiPublicKey);

  // Extraer metadatos
  const metadata = {
    mint: digitalAsset.mint.publicKey,
    name: digitalAsset.metadata.name,
    symbol: digitalAsset.metadata.symbol,
    uri: digitalAsset.metadata.uri,
    decimals: digitalAsset.mint.decimals,
    supply: digitalAsset.mint.supply,
    updateAuthority: digitalAsset.metadata.updateAuthority,
  };

  return metadata;
}


// Función para obtener todas las cuentas de token con saldo positivo
const getTokenAccounts = async () => {
  try {
    const connection = new Connection(RPC_URL, "confirmed");

    const response = await connection.getParsedTokenAccountsByOwner(OWNER_ADDRESS, {
      programId: TOKEN_PROGRAM_ID,
    });

    if (response.value.length === 0) {
      console.log(`❌ No se encontraron cuentas de tokens para ${OWNER_ADDRESS.toBase58()}`);
      return [];
    }

    // Filtrar solo tokens con cantidad > 0
    const positiveTokenAccounts = response.value.filter(accountInfo => {
      const tokenAmount = accountInfo.account.data.parsed.info.tokenAmount;
      return parseInt(tokenAmount.amount) > 0;
    });

    console.log("====================");
    console.log(`✅ Total de cuentas con saldo positivo: ${positiveTokenAccounts.length}`);

    const results = [];

    for (const accountInfo of positiveTokenAccounts) {
      const parsedInfo = accountInfo.account.data.parsed.info;
      const mintPublicKey = new PublicKey(parsedInfo.mint);
      const tokenAmount = parsedInfo.tokenAmount;
      const tokenMetadata = await getTokenMetadata(mintPublicKey);
      const amount = parseInt(tokenAmount.amount) / Math.pow(10, tokenAmount.decimals);

      console.log(JSON.stringify(tokenMetadata,null,2));

      console.log("====================");
      console.log(`🔗 Pubkey de la Cuenta de Token: ${accountInfo.pubkey.toBase58()}`);
      console.log(`💎 Mint (Token ID): ${mintPublicKey.toBase58()}`);
      console.log(`🏷️ Nombre del Token: ${tokenMetadata.name} - ${tokenMetadata.symbol}`);
      console.log(`👤 Propietario: ${parsedInfo.owner}`);
      console.log(`🔢 Decimales: ${tokenAmount.decimals}`);
      console.log(`💰 Cantidad (Raw): ${tokenAmount.amount}`);
      console.log(`💰 Cantidad (Decimal): ${amount}`);

      results.push({
        account: accountInfo.pubkey.toBase58(),
        mint: mintPublicKey.toBase58(),
        name: tokenMetadata?.name ?? "N/A",
        symbol: tokenMetadata?.symbol ?? "N/A",
        amount,
      });
    }

    return results;
  } catch (error) {
    console.error("❌ Error al obtener las cuentas de token:", error);
    return [];
  }
};

export async function DashboardFeature() {
  const tokens = await getTokenAccounts();

  return (
    <div className="p-6">
      <AppHero title="Dashboard de Tokens" subtitle="Cuentas con saldo positivo" />

      <h2 className="mt-4 text-lg font-semibold">
        Total de cuentas con saldo positivo: {tokens.length}
      </h2>

      {tokens.length === 0 ? (
        <p>No se encontraron tokens con balance positivo.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {tokens.map((t) => (
            <li key={t.mint} className="border p-2 rounded-md">
              <strong>{t.name}</strong> ({t.symbol}): {t.amount} tokens
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
