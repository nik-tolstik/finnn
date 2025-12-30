import { unlink } from "fs/promises";
import { join } from "path";

import { UTApi } from "uploadthing/server";

const hasUploadthingToken = !!process.env.UPLOADTHING_TOKEN;

export async function deleteAvatar(url: string | null | undefined) {
  if (!url) return;

  try {
    if (hasUploadthingToken) {
      const utapi = new UTApi();
      if (url.includes("uploadthing.com") || url.includes("utfs.io")) {
        const fileKey = url.split("/").pop()?.split("?")[0];
        if (fileKey) {
          await utapi.deleteFiles(fileKey);
        }
      }
    } else {
      if (url.startsWith("/uploads/avatars/")) {
        const filePath = join(process.cwd(), "public", url);
        try {
          await unlink(filePath);
        } catch (error: any) {
          if (error.code !== "ENOENT") {
            console.error("Error deleting avatar:", error);
          }
        }
      }
    }
  } catch (error: any) {
    console.error("Error deleting avatar:", error);
  }
}

export function isLocalStorage(): boolean {
  return !hasUploadthingToken;
}
