import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

if (existsSync(".env")) process.loadEnvFile(".env");

// Migrations run as the database OWNER (bypasses RLS); the app never uses this URL.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.MIGRATE_DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
