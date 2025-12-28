import { NextResponse } from "next/server";

export async function GET() {
  const isProduction = process.env.NODE_ENV === "production";
  return NextResponse.json({ useUploadthing: isProduction });
}

