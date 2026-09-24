/* eslint-disable */
// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { randomUUID } from "crypto";

// GET all categories
export async function GET() {
  try {
    const results = await db.select().from(categories);
    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("GET categories API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil data kategori" },
      { status: 500 }
    );
  }
}

// POST new category
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ success: false, message: "Nama kategori wajib diisi" }, { status: 400 });
    }

    const newCategory = {
      id: "cat-" + randomUUID().substring(0, 8),
      name,
      description: description || null,
    };

    await db.insert(categories).values(newCategory);

    return NextResponse.json({ success: true, data: newCategory });
  } catch (error) {
    console.error("POST category API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal membuat kategori" },
      { status: 500 }
    );
  }
}
