/* eslint-disable */
// @ts-nocheck
import { db } from "./src/db/index";
import { users, categories, products } from "./src/db/schema";
import { sql } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");
  
  console.log("Skipping user seed in seed.ts (managed in scripts/seed.js)");

  // Create category
  try {
    await db.insert(categories).values([
      { id: "cat-1", name: "Sembako", description: "Bahan pokok" },
      { id: "cat-2", name: "Minuman", description: "Minuman ringan" },
      { id: "cat-3", name: "Snack", description: "Makanan ringan" }
    ]);
    console.log("Categories seeded!");
  } catch (err) {
    console.log("Categories might already exist", err);
  }

  console.log("Seed done!");
}

seed();
