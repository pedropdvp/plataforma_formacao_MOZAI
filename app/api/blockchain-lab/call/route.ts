import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { decryptSecret } from "@/lib/crypto";
import { ethers } from "ethers";
import { BLOCKCHAIN_LAB_NETWORK } from "@/lib/blockchain/networks";
import { logAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 30;

// POST — Chama uma função real de um contrato já implantado em Sepolia: leituras (view/pure)
// são gratuitas e imediatas; escritas assinam e enviam uma transação real (paga pela carteira
// de testnet do utilizador) e aguardam o recibo real.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { abi, contractAddress, functionName, args, isReadOnly } = await req.json();
    if (!abi || !contractAddress || !functionName) {
      return NextResponse.json({ error: "ABI, endereço do contrato e nome da função são obrigatórios." }, { status: 400 });
    }

    const provider = new ethers.JsonRpcProvider(BLOCKCHAIN_LAB_NETWORK.rpcUrl);

    if (isReadOnly) {
      const contract = new ethers.Contract(contractAddress, abi, provider);
      const result = await contract[functionName](...(args || []));
      return NextResponse.json({ success: true, result: String(result) });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const record = await db.collection("user_integrations").findOne({ tenant_id: tenantId, userId, provider: "blockchain_testnet_wallet" });
    if (!record) {
      return NextResponse.json({ error: "Configure primeiro a sua carteira de testnet para chamadas de escrita." }, { status: 400 });
    }

    const privateKey = decryptSecret(record.tokenEncrypted);
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, abi, wallet);

    const tx = await contract[functionName](...(args || []));
    const receipt = await tx.wait();

    await logAuditEvent(userId, "BLOCKCHAIN_LAB_CALL", { tenantId, contractAddress, functionName, txHash: receipt?.hash });

    return NextResponse.json({
      success: true,
      txHash: receipt?.hash,
      explorerTxUrl: receipt?.hash ? BLOCKCHAIN_LAB_NETWORK.explorerTxUrl(receipt.hash) : null,
    });
  } catch (error: any) {
    console.error("Erro ao chamar contrato:", error);
    return NextResponse.json({ error: error.shortMessage || error.message }, { status: 500 });
  }
}
