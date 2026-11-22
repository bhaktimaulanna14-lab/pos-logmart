import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/session";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export type Role = "manajer" | "kasir";

type AuthResult =
  | { session: SessionPayload; error?: undefined }
  | { session?: undefined; error: NextResponse };

/**
 * Pastikan request berasal dari user yang login (dan, bila diberikan, ber-role tertentu).
 * Selalu panggil di route handler yang menulis data — jangan andalkan proxy (src/proxy.ts) saja.
 *
 *   const auth = await requireSession("manajer");
 *   if (auth.error) return auth.error;
 *   const { session } = auth;
 */
export async function requireSession(role?: Role | Role[]): Promise<AuthResult> {
  const session = await getSession();
  if (!session) {
    return {
      error: NextResponse.json({ success: false, message: "Sesi tidak valid. Silakan login ulang." }, { status: 401 }),
    };
  }
  // Akun yang dinonaktifkan langsung kehilangan akses, walau token sesinya belum kedaluwarsa.
  const current = await db
    .select({ isActive: users.isActive, role: users.role })
    .from(users)
    .where(eq(users.id, session.id))
    .get();
  if (!current || !current.isActive) {
    return {
      error: NextResponse.json({ success: false, message: "Akun tidak aktif. Silakan hubungi manajer." }, { status: 401 }),
    };
  }
  // Pakai peran terbaru dari database (bisa berubah setelah login).
  session.role = current.role;
  if (role) {
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(session.role as Role)) {
      return {
        error: NextResponse.json({ success: false, message: "Akses ditolak untuk peran Anda." }, { status: 403 }),
      };
    }
  }
  return { session };
}

/** Bilangan bulat >= min, atau null bila tidak valid. */
export function toInt(value: unknown, min = 0): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < min) return null;
  return n;
}

/** Error yang aman ditampilkan ke user; route handler mengubahnya menjadi respons 4xx. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function errorResponse(error: unknown, fallbackMessage: string, logLabel: string) {
  if (error instanceof ApiError) {
    return NextResponse.json({ success: false, message: error.message }, { status: error.status });
  }
  console.error(logLabel, error);
  return NextResponse.json({ success: false, message: fallbackMessage }, { status: 500 });
}
