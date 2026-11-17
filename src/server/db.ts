import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

function create() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");
  const url = new URL(raw);
  // Hosted MySQL (TiDB Cloud, Aiven, PlanetScale...) requires TLS; local Docker does not.
  const ssl = ["true", "1", "required", "verify_ca", "verify_identity"].includes(
    (url.searchParams.get("ssl") ?? url.searchParams.get("sslmode") ?? url.searchParams.get("ssl-mode") ?? "").toLowerCase(),
  );
  const isLocalDatabase = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    // Each serverless instance holds its own pool, so keep it small on Vercel.
    connectionLimit: Number(process.env.DB_POOL_SIZE) || (process.env.VERCEL ? 3 : 10),
    timezone: "Z",
    // The first login after MySQL starts needs the server's RSA public key.
    allowPublicKeyRetrieval: isLocalDatabase && !ssl,
    // DATABASE_CA: PEM of the provider's private CA (Aiven signs with its own, which Node doesn't trust by default).
    ...(ssl ? { ssl: { rejectUnauthorized: true, ca: process.env.DATABASE_CA } } : {}),
  });
  return new PrismaClient({ adapter });
}

const g = globalThis as unknown as { __prisma?: PrismaClient };
export const prisma = g.__prisma ?? (g.__prisma = create());
