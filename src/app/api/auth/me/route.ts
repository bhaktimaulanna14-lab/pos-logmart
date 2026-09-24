import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("pos_session")?.value;

  if (!sessionCookie) {
    return NextResponse.json({ success: false, message: "Belum login" }, { status: 401 });
  }

  const session = await decrypt(sessionCookie);

  if (!session) {
    return NextResponse.json({ success: false, message: "Sesi tidak valid" }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    data: session
  });
}
