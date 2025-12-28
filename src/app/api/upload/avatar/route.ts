"use server";

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/shared/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Файл не найден" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Файл должен быть изображением" },
        { status: 400 }
      );
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Размер файла не должен превышать 5MB" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileExtension = file.name.split(".").pop() || "jpg";
    const fileName = `${session.user.id}-${Date.now()}.${fileExtension}`;
    const uploadDir = join(process.cwd(), "public", "uploads", "avatars");

    await mkdir(uploadDir, { recursive: true });

    const filePath = join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    const imageUrl = `/uploads/avatars/${fileName}`;

    return NextResponse.json({ url: imageUrl });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Не удалось загрузить файл" },
      { status: 500 }
    );
  }
}

