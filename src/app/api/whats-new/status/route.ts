import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { APP_VERSION } from "@/shared/constants/changelog";
import { authOptions } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const status = await prisma.whatsNewStatus.findUnique({
      where: { userId: session.user.id },
      select: {
        version: true,
        shown: true,
      },
    });

    return NextResponse.json({ data: status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Не удалось получить статус" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    await prisma.whatsNewStatus.upsert({
      where: { userId: session.user.id },
      update: {
        version: APP_VERSION,
        shown: true,
      },
      create: {
        userId: session.user.id,
        version: APP_VERSION,
        shown: true,
      },
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Не удалось обновить статус" }, { status: 500 });
  }
}
