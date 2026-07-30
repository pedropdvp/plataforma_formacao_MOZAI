import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { getAwsCredentials } from "@/lib/cloud-lab/aws-client";
import { logAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 20;

// GET — Lista RECURSOS REAIS da conta AWS do utilizador: buckets S3 (chamada global,
// ListBuckets) e instâncias EC2 na região configurada (DescribeInstances) — ambas operações
// só de leitura, nunca criam/alteram nada. Se a conta não tiver recursos, a lista fica
// genuinamente vazia (nunca inventada).
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const creds = await getAwsCredentials(tenantId, userId);
    if (!creds) {
      return NextResponse.json({ error: "Ligue primeiro a sua conta AWS." }, { status: 400 });
    }

    const s3 = new S3Client({ region: creds.region, credentials: creds });
    const ec2 = new EC2Client({ region: creds.region, credentials: creds });

    const [bucketsResult, instancesResult] = await Promise.allSettled([
      s3.send(new ListBucketsCommand({})),
      ec2.send(new DescribeInstancesCommand({})),
    ]);

    const buckets =
      bucketsResult.status === "fulfilled"
        ? (bucketsResult.value.Buckets || []).map((b) => ({ name: b.Name, createdAt: b.CreationDate }))
        : [];
    const bucketsError = bucketsResult.status === "rejected" ? bucketsResult.reason?.message : null;

    const instances =
      instancesResult.status === "fulfilled"
        ? (instancesResult.value.Reservations || []).flatMap((r) =>
            (r.Instances || []).map((i) => ({
              id: i.InstanceId,
              type: i.InstanceType,
              state: i.State?.Name,
              az: i.Placement?.AvailabilityZone,
            }))
          )
        : [];
    const instancesError = instancesResult.status === "rejected" ? instancesResult.reason?.message : null;

    await logAuditEvent(userId, "CLOUD_LAB_AWS_RESOURCES_LISTED", { tenantId, bucketsCount: buckets.length, instancesCount: instances.length });

    return NextResponse.json({ success: true, region: creds.region, buckets, bucketsError, instances, instancesError });
  } catch (error: any) {
    console.error("Erro ao listar recursos AWS:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
