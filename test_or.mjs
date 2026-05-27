import { PrismaClient } from "@prisma/client";
import { createDecipheriv, pbkdf2Sync } from "crypto";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env","utf8").split(/\r?\n/).filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
function decrypt(e,iv){let salt,ib;if(iv.includes(".")){const[s,i]=iv.split(".");salt=Buffer.from(s,"base64");ib=i;}else{salt="jobsync-api-key-encryption";ib=iv;}const key=pbkdf2Sync(env.ENCRYPTION_KEY,salt,100000,32,"sha256");const c=Buffer.from(e,"base64");const t=c.subarray(c.length-16);const d=createDecipheriv("aes-256-gcm",key,Buffer.from(ib,"base64"),{authTagLength:16});d.setAuthTag(t);return Buffer.concat([d.update(c.subarray(0,c.length-16)),d.final()]).toString("utf8");}
const db=new PrismaClient();
const u=await db.user.findUnique({where:{email:"jiragalen@gmail.com"}});
const k=await db.apiKey.findUnique({where:{userId_provider:{userId:u.id,provider:"openrouter"}}});
const key=decrypt(k.encryptedKey,k.iv);

console.log("--- /models WITHOUT auth ---");
let r = await fetch("https://openrouter.ai/api/v1/models");
console.log("status:", r.status);

console.log("--- /models with GARBAGE auth ---");
r = await fetch("https://openrouter.ai/api/v1/models", {headers:{Authorization:"Bearer sk-or-totally-invalid-xyz"}});
console.log("status:", r.status);

console.log("--- /key (auth-check endpoint) with stored key ---");
r = await fetch("https://openrouter.ai/api/v1/key", {headers:{Authorization:`Bearer ${key}`}});
console.log("status:", r.status, "body:", (await r.text()).slice(0,300));

console.log("--- /auth/key with stored key ---");
r = await fetch("https://openrouter.ai/api/v1/auth/key", {headers:{Authorization:`Bearer ${key}`}});
console.log("status:", r.status, "body:", (await r.text()).slice(0,300));
await db.$disconnect();
