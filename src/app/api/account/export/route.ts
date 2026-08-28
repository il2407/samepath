import { NextResponse } from "next/server";
import { getCurrentSession } from "@/modules/auth/session";
import { exportAccountData } from "@/modules/account/service";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const data = await exportAccountData(session.user.id);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="samepath-export-${session.user.id}.json"`,
    },
  });
}
