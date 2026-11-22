import { rateLimit } from "@/lib/server/rate-limit";
import { z } from "zod";
import {
  adminServices,
  apiError,
  readJson,
  requireAccount,
  ApiError,
} from "@/lib/server/firebase-admin";
import { issueToken, SCOPES } from "@/lib/server/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    rateLimit(request, "connections", 30);
    const account = await requireAccount(request);
    const result = await adminServices()
      .db.collection("integrationConnections")
      .where("uid", "==", account.uid)
      .get();
    return Response.json(
      {
        connections: result.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .filter((item) => !(item as { revoked?: boolean }).revoked),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    rateLimit(request, "connections", 30);
    const account = await requireAccount(request);
    const input = z
      .object({
        name: z.string().trim().min(1).max(80),
        readOnly: z.boolean().default(false),
      })
      .strict()
      .safeParse(await readJson(request, 2000));
    if (!input.success)
      throw new ApiError(400, "Укажите название подключения.");
    const result = await issueToken(
      account.uid,
      input.data.name,
      input.data.readOnly ? ["records:read"] : [...SCOPES],
    );
    return Response.json(result, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    rateLimit(request, "connections", 30);
    const account = await requireAccount(request);
    const input = z
      .object({ id: z.string().uuid() })
      .safeParse(await readJson(request, 1000));
    if (!input.success) throw new ApiError(400, "Некорректное подключение.");
    const reference = adminServices()
      .db.collection("integrationConnections")
      .doc(input.data.id);
    await adminServices().db.runTransaction(async (transaction) => {
      const record = await transaction.get(reference);
      if (record.data()?.uid !== account.uid)
        throw new ApiError(404, "Подключение не найдено.");
      transaction.update(reference, { revoked: true });
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
