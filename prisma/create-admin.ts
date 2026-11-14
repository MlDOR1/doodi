import "dotenv/config";
import { prisma } from "../src/server/db";
import { hashPassword } from "../src/server/auth";

// Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' ADMIN_NAME='ชื่อ' npm run db:create-admin
// Creates the account, or promotes an existing one to admin and resets its password.
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const displayName = process.env.ADMIN_NAME?.trim() || "ผู้ดูแล DOODI";
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD");
  if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters");
  const passwordHash = await hashPassword(password);
  await prisma.user.upsert({
    where: { email },
    create: { email, displayName, passwordHash, role: "admin" },
    update: { passwordHash, role: "admin" },
  });
  console.log(`Admin ready: ${email}`);
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
