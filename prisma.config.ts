import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const caPath = resolve(
  projectRoot,
  process.env.SUPABASE_CA_CERT_PATH ?? "certs/supabase-prod-ca-2021.crt",
);
const directUrl = new URL(env("DIRECT_URL"));
directUrl.searchParams.set("sslmode", "verify-full");
directUrl.searchParams.set("sslrootcert", caPath);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: directUrl.toString(),
  },
});
