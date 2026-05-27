import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const email = "jiragalen@gmail.com";
const user = await db.user.findUnique({ where: { email } });
if (!user) { console.log("NO USER for", email); process.exit(0); }
console.log("USER:", user.id, user.name, user.email);
const settings = await db.userSettings.findUnique({ where: { userId: user.id } });
console.log("SETTINGS RAW:", settings?.settings ?? "(none)");
const keys = await db.apiKey.findMany({ where: { userId: user.id } });
console.log("API KEYS:", JSON.stringify(keys.map(k => ({ provider: k.provider, last4: k.last4, ivEmpty: k.iv === "", lastUsedAt: k.lastUsedAt })), null, 2));
await db.$disconnect();
