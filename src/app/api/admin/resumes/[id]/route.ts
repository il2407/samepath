import { NextResponse } from "next/server";
import { getCurrentSession } from "@/modules/auth/session";
import { getResumeFileForAdmin } from "@/modules/admin/users";

// Staff-only: streams a member's uploaded resume so an admin can review it
// before approving the account (/admin/users/[id]). Served inline so PDFs
// open in the browser; `?download=1` forces a save instead.
export async function GET(request: Request, { params }: RouteContext<"/api/admin/resumes/[id]">) {
  const session = await getCurrentSession();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "MODERATOR")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const file = await getResumeFileForAdmin(id);
  if (!file) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const download = new URL(request.url).searchParams.has("download");
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
