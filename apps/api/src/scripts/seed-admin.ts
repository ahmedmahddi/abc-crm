import * as argon2 from "argon2";
import { PrismaClient } from "@abc/db";

const prisma = new PrismaClient();

async function seedAdmin() {
  const email = requireEnvironmentValue("ADMIN_EMAIL").toLowerCase();
  const name = requireEnvironmentValue("ADMIN_NAME");
  const password = requireEnvironmentValue("ADMIN_PASSWORD");

  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must contain at least 12 characters");
  }

  const passwordHash = await argon2.hash(password);

  await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
    create: {
      name,
      email,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  console.log(`ADMIN account ready: ${email}`);
}

function requireEnvironmentValue(name: "ADMIN_EMAIL" | "ADMIN_NAME" | "ADMIN_PASSWORD") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

seedAdmin()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Unable to seed ADMIN account");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
