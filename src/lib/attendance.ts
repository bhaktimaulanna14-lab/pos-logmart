import { db } from "@/db";
import { shifts, users } from "@/db/schema";
import { and, eq, gte, lt, asc } from "drizzle-orm";
import type { ReportPeriod } from "@/lib/report-period";

export type AttendanceRow = {
  userId: string;
  userName: string;
  totalShifts: number;
  totalWorkMs: number;
  avgWorkMs: number;
  /** Shift yang masih buka saat ini (durasinya dihitung sampai sekarang). */
  openShifts: number;
  firstIn: string | null;
  lastIn: string | null;
};

/**
 * Rekap absensi kasir dari buka/tutup shift pada periode terpilih (berdasarkan jam buka shift).
 * Shift yang belum ditutup ikut dihitung sampai `now` dan ditandai di `openShifts`.
 */
export async function getAttendance(period: ReportPeriod, now = new Date()): Promise<AttendanceRow[]> {
  const rows = await db
    .select({
      userId: shifts.userId,
      userName: users.name,
      openAt: shifts.openAt,
      closeAt: shifts.closeAt,
      status: shifts.status,
    })
    .from(shifts)
    .innerJoin(users, eq(shifts.userId, users.id))
    .where(and(eq(users.role, "kasir"), gte(shifts.openAt, period.startIso), lt(shifts.openAt, period.endIso)))
    .orderBy(asc(shifts.openAt));

  const map = new Map<string, AttendanceRow>();
  for (const s of rows) {
    const isOpen = s.status === "buka" || !s.closeAt;
    const end = isOpen ? now.getTime() : new Date(s.closeAt!).getTime();
    const duration = Math.max(0, end - new Date(s.openAt).getTime());

    const rec =
      map.get(s.userId) ??
      { userId: s.userId, userName: s.userName, totalShifts: 0, totalWorkMs: 0, avgWorkMs: 0, openShifts: 0, firstIn: null, lastIn: null };
    rec.totalShifts += 1;
    rec.totalWorkMs += duration;
    if (isOpen) rec.openShifts += 1;
    rec.firstIn ??= s.openAt;
    rec.lastIn = s.openAt;
    map.set(s.userId, rec);
  }

  return [...map.values()]
    .map((r) => ({ ...r, avgWorkMs: r.totalShifts ? Math.floor(r.totalWorkMs / r.totalShifts) : 0 }))
    .sort((a, b) => a.userName.localeCompare(b.userName));
}

export function formatDuration(ms: number): string {
  const totalMins = Math.floor(ms / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours === 0 && mins === 0) return "-";
  return `${hours} jam ${mins} menit`;
}
