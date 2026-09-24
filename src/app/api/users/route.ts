/* eslint-disable */
// @ts-nocheck
import { NextResponse, NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { randomUUID } from "crypto";

export async function GET() {
  try {
    const results = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        role: users.role,
      })
      .from(users);

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("GET users API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil daftar pengguna" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, username, password, role } = body;

    if (!name || !username || !password || !role) {
      return NextResponse.json({ success: false, message: "Data tidak lengkap" }, { status: 400 });
    }

    const { hashPassword } = await import("@/lib/auth-helper");
    const hashedPassword = await hashPassword(password);

    const newUser = {
      id: "user-" + randomUUID().substring(0, 8),
      name,
      username,
      passwordHash: hashedPassword,
      role,
    };

    await db.insert(users).values(newUser);

    return NextResponse.json({ 
      success: true, 
      data: {
        id: newUser.id,
        name: newUser.name,
        username: newUser.username,
        role: newUser.role
      } 
    });
  } catch (error) {
    console.error("POST user API error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal membuat pengguna. Username mungkin sudah ada." },
      { status: 500 }
    );
  }
}
