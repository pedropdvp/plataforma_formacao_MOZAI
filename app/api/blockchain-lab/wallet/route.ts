import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { ethers } from "ethers";
import { BLOCKCHAIN_LAB_NETWORK } from "@/lib/blockchain/networks";
import { logAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 15;

// GET — Estado real da carteira de testnet do utilizador: endereço e saldo REAL em Sepolia
// (consultado on-chain via RPC público) — nunca inventado. Nunca devolve a chave privada.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const record = await db.collection("user_integrations").findOne({ tenant_id: tenantId, userId, provider: "blockchain_testnet_wallet" });

    if (!record) {
      return NextResponse.json({ success: true, configured: false });
    }

    const privateKey = decryptSecret(record.tokenEncrypted);
    const provider = new ethers.JsonRpcProvider(BLOCKCHAIN_LAB_NETWORK.rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    let balanceEth = "0";
    try {
      const balance = await provider.getBalance(wallet.address);
      balanceEth = ethers.formatEther(balance);
    } catch (e) {
      console.warn("Erro ao consultar saldo na Sepolia:", e);
    }

    return NextResponse.json({ success: true, configured: true, address: wallet.address, balanceEth, network: BLOCKCHAIN_LAB_NETWORK.name, faucetUrl: BLOCKCHAIN_LAB_NETWORK.faucetUrl });
  } catch (error: any) {
    console.error("Erro ao ler carteira de testnet:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Guarda a chave privada de uma carteira de TESTNET (encriptada, AES-256-GCM),
// exclusivamente para uso em Sepolia. Nunca deve ser uma carteira com fundos reais.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { privateKey } = await req.json();
    if (!privateKey?.trim()) {
      return NextResponse.json({ error: "Introduza uma chave privada válida." }, { status: 400 });
    }

    let wallet;
    try {
      wallet = new ethers.Wallet(privateKey.trim());
    } catch {
      return NextResponse.json({ error: "Chave privada inválida (deve ser um hex de 32 bytes, ex: 0x...)." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    await db.collection("user_integrations").updateOne(
      { tenant_id: tenantId, userId, provider: "blockchain_testnet_wallet" },
      { $set: { tokenEncrypted: encryptSecret(privateKey.trim()), address: wallet.address, updatedAt: new Date() } },
      { upsert: true }
    );

    await logAuditEvent(userId, "BLOCKCHAIN_LAB_WALLET_SAVED", { tenantId, address: wallet.address });

    return NextResponse.json({ success: true, address: wallet.address });
  } catch (error: any) {
    console.error("Erro ao guardar carteira de testnet:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Remove a carteira de testnet guardada.
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }
    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    await db.collection("user_integrations").deleteOne({ tenant_id: tenantId, userId, provider: "blockchain_testnet_wallet" });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
