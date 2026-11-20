import "server-only";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkServerIdentity } from "node:tls";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
const caPath = resolve(
  process.cwd(),
  process.env.SUPABASE_CA_CERT_PATH ?? "certs/supabase-prod-ca-2021.crt",
);

if (!connectionString) {
  throw new Error("DATABASE_URL must be set before using Prisma.");
}

const ca = readFileSync(caPath, "utf8");

const globalForPrisma = globalThis as typeof globalThis & {
  campusConnectPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.campusConnectPrisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      ssl: {
        ca,
        checkServerIdentity,
        rejectUnauthorized: true,
      },
    }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.campusConnectPrisma = prisma;
}
