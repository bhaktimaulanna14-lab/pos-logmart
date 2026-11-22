import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const dbFile = process.env.DATABASE || "sqlite.db";
const sqlite = new Database(dbFile);

// WAL: pembaca (laporan, daftar barang) tidak memblokir penulis (kasir checkout) dan sebaliknya.
sqlite.pragma("journal_mode = WAL");
// Aman untuk WAL dan jauh lebih cepat daripada FULL.
sqlite.pragma("synchronous = NORMAL");
// Tunggu sebentar bila database sedang dikunci proses lain, alih-alih langsung error.
sqlite.pragma("busy_timeout = 5000");
// Integritas relasi (better-sqlite3 sudah mengaktifkan ini secara default; dibuat eksplisit).
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
