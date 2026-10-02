import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "actions",
    runtimeId: "actions-runtime-v1",
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
