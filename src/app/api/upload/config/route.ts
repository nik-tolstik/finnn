import { NextResponse } from "next/server";

export async function GET() {
  const hasUploadthingToken = !!process.env.UPLOADTHING_TOKEN;
  return NextResponse.json({ useUploadthing: hasUploadthingToken });
}

