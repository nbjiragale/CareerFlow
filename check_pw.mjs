import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const db = new PrismaClient();
const u = await db.user.findUnique({ where: { email: "jiragalen@gmail.com" } });
console.log("user found:", !!u, "name:", u?.name);
console.log("password matches 'Niranjan@9742':", await bcrypt.compare("Niranjan@9742", u.password));
await db.$disconnect();
