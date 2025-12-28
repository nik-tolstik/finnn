import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function changePassword(email: string, newPassword: string) {
  console.log(`Поиск пользователя с email: ${email}`);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error(`Пользователь с email ${email} не найден`);
  }

  console.log(`Хеширование нового пароля...`);
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  console.log(`Обновление пароля для пользователя ${user.email}...`);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  console.log(`✅ Пароль успешно изменен для пользователя ${user.email}`);
}

async function main() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.error("Использование: tsx scripts/change-password.ts <email> <newPassword>");
    process.exit(1);
  }

  try {
    await changePassword(email, newPassword);
  } catch (error) {
    console.error("Ошибка:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

