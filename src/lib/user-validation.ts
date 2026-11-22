import { ApiError } from "@/lib/api-auth";

export const USER_ROLES = ["manajer", "kasir"] as const;
export const MIN_PASSWORD_LENGTH = 8;

export type UserInput = {
  name?: string;
  username?: string;
  role?: (typeof USER_ROLES)[number];
  password?: string;
  isActive?: boolean;
};

/**
 * Validasi data pengguna dari body request. Field yang tidak dikirim diabaikan
 * (untuk edit sebagian), kecuali `requirePassword` / data wajib saat membuat user.
 */
export function validateUserInput(body: Record<string, unknown>, opts: { requirePassword?: boolean } = {}): UserInput {
  const creating = !!opts.requirePassword;
  const out: UserInput = {};

  if (body.name !== undefined || creating) {
    const name = String(body.name ?? "").trim();
    if (!name) throw new ApiError(400, "Nama wajib diisi");
    if (name.length > 80) throw new ApiError(400, "Nama terlalu panjang (maks. 80 karakter)");
    out.name = name;
  }

  if (body.username !== undefined || creating) {
    const username = String(body.username ?? "").trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      throw new ApiError(400, "Username 3–30 karakter: huruf kecil, angka, titik, minus, atau garis bawah (tanpa spasi)");
    }
    out.username = username;
  }

  if (body.role !== undefined || creating) {
    if (!USER_ROLES.includes(body.role as (typeof USER_ROLES)[number])) {
      throw new ApiError(400, "Peran harus Manajer atau Kasir");
    }
    out.role = body.role as (typeof USER_ROLES)[number];
  }

  if (body.password !== undefined && body.password !== "" || creating) {
    const password = String(body.password ?? "");
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new ApiError(400, `Password minimal ${MIN_PASSWORD_LENGTH} karakter`);
    }
    out.password = password;
  }

  if (body.isActive !== undefined) out.isActive = Boolean(body.isActive);

  return out;
}
