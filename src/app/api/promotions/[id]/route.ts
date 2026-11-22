import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { promotions, transactionItems } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireSession, ApiError, errorResponse } from "@/lib/api-auth";
import { validatePromotionInput } from "@/lib/promotion-validation";

type Params = { params: Promise<{ id: string }> };

// Ubah promo. Body boleh hanya { isActive } untuk mengaktifkan/menonaktifkan.
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const id = (await params).id;
    const body = await request.json();
    const existing = await db.select().from(promotions).where(eq(promotions.id, id)).get();
    if (!existing) throw new ApiError(404, "Promo tidak ditemukan");

    const onlyToggle = Object.keys(body).length === 1 && "isActive" in body;
    const update = onlyToggle ? { isActive: Boolean(body.isActive) } : validatePromotionInput({ ...existing, ...body });

    await db.update(promotions).set(update).where(eq(promotions.id, id));
    return NextResponse.json({ success: true, message: "Promo berhasil diperbarui" });
  } catch (error) {
    return errorResponse(error, "Gagal memperbarui promo", "PUT promotion error:");
  }
}

// Hapus promo yang belum pernah dipakai. Promo yang sudah dipakai cukup dinonaktifkan agar riwayat tetap utuh.
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const auth = await requireSession("manajer");
    if (auth.error) return auth.error;

    const id = (await params).id;
    const used = db
      .select({ n: sql<number>`count(*)` })
      .from(transactionItems)
      .where(eq(transactionItems.promotionId, id))
      .get();
    if (Number(used?.n ?? 0) > 0) {
      throw new ApiError(409, "Promo sudah pernah dipakai di transaksi. Nonaktifkan saja agar riwayat tetap utuh.");
    }
    const result = db.delete(promotions).where(eq(promotions.id, id)).run();
    if (result.changes === 0) throw new ApiError(404, "Promo tidak ditemukan");
    return NextResponse.json({ success: true, message: "Promo dihapus" });
  } catch (error) {
    return errorResponse(error, "Gagal menghapus promo", "DELETE promotion error:");
  }
}
