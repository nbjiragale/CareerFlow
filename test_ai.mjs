import { PrismaClient } from "@prisma/client";
import { createDecipheriv, pbkdf2Sync } from "crypto";
import fs from "node:fs";

// load .env
const env = Object.fromEntries(
  fs.readFileSync(".env","utf8").split(/\r?\n/)
    .filter(l=>l && !l.startsWith("#") && l.includes("="))
    .map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim()];})
);
const ENCRYPTION_KEY = env.ENCRYPTION_KEY;

function decrypt(encryptedData, iv) {
  let salt, ivBase64;
  if (iv.includes(".")) { const [s,i]=iv.split("."); salt=Buffer.from(s,"base64"); ivBase64=i; }
  else { salt="jobsync-api-key-encryption"; ivBase64=iv; }
  const key = pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, "sha256");
  const ivBuffer = Buffer.from(ivBase64,"base64");
  const combined = Buffer.from(encryptedData,"base64");
  const authTag = combined.subarray(combined.length-16);
  const enc = combined.subarray(0, combined.length-16);
  const d = createDecipheriv("aes-256-gcm", key, ivBuffer, {authTagLength:16});
  d.setAuthTag(authTag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

const db = new PrismaClient();
const user = await db.user.findUnique({ where: { email: "jiragalen@gmail.com" } });
const k = await db.apiKey.findUnique({ where: { userId_provider: { userId: user.id, provider: "openrouter" } } });
let key;
try { key = decrypt(k.encryptedKey, k.iv); console.log("DECRYPT OK, prefix:", key.slice(0,8), "len:", key.length); }
catch(e){ console.log("DECRYPT FAILED:", e.message); process.exit(1); }

// 1) models endpoint
const m = await fetch("https://openrouter.ai/api/v1/models", { headers: { Authorization: `Bearer ${key}` } });
console.log("MODELS endpoint status:", m.status);

// 2) actual chat completion with openai/gpt-4o
const c = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "openai/gpt-4o", messages: [{role:"user", content:"Reply with just: OK"}], max_tokens: 5 })
});
console.log("CHAT status:", c.status);
const body = await c.text();
console.log("CHAT body:", body.slice(0, 600));
await db.$disconnect();
