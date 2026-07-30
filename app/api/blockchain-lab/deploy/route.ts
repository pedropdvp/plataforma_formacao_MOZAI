import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { decryptSecret } from "@/lib/crypto";
import { ethers } from "ethers";
import { BLOCKCHAIN_LAB_NETWORK } from "@/lib/blockchain/networks";
import { logAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST — Implanta REALMENTE o contrato (ABI + bytecode já compilados) na testnet Sepolia,
// usando a carteira de testnet do próprio utilizador para pagar o gas. Devolve o hash de
// transação e o endereço do contrato reais — verificáveis no Etherscan Sepolia. Nunca simula
// uma implantação: se a carteira não tiver ETH de teste suficiente, o erro real é devolvido.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { abi, bytecode, constructorArgs } = await req.json();
    if (!abi || !bytecode) {
      return NextResponse.json({ error: "ABI e bytecode são obrigatórios (compile o código primeiro)." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const record = await db.collection("user_integrations").findOne({ tenant_id: tenantId, userId, provider: "blockchain_testnet_wallet" });
    if (!record) {
      return NextResponse.json({ error: "Configure primeiro a sua carteira de testnet." }, { status: 400 });
    }

    const privateKey = decryptSecret(record.tokenEncrypted);
    const provider = new ethers.JsonRpcProvider(BLOCKCHAIN_LAB_NETWORK.rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    const factory = new ethers.ContractFactory(abi, bytecode, wallet);

    let contract;
    try {
      contract = await factory.deploy(...(constructorArgs || []));
    } catch (err: any) {
      return NextResponse.json({ error: `Falha ao implantar: ${err.shortMessage || err.message}` }, { status: 502 });
    }

    const deployTx = contract.deploymentTransaction();
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();

    await logAuditEvent(userId, "BLOCKCHAIN_LAB_DEPLOY", { tenantId, contractAddress, txHash: deployTx?.hash });

    return NextResponse.json({
      success: true,
      contractAddress,
      txHash: deployTx?.hash,
      explorerTxUrl: deployTx?.hash ? BLOCKCHAIN_LAB_NETWORK.explorerTxUrl(deployTx.hash) : null,
      explorerAddressUrl: BLOCKCHAIN_LAB_NETWORK.explorerAddressUrl(contractAddress),
    });
  } catch (error: any) {
    console.error("Erro ao implantar contrato:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
