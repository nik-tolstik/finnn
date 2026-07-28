import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";

import { ObjectStorageService } from "@/storage/object-storage.service";

export type AvatarUploadInput = {
  userId: string;
  buffer: Buffer;
  contentType: string;
};

function getExtensionForContentType(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

@Injectable()
export class AvatarStorageService {
  constructor(@Inject(ObjectStorageService) private readonly storage: ObjectStorageService) {}

  async upload(input: AvatarUploadInput): Promise<string> {
    const key = `avatars/${input.userId}/${randomUUID()}.${getExtensionForContentType(input.contentType)}`;

    await this.storage.upload({ key, buffer: input.buffer, contentType: input.contentType });

    return key;
  }

  async delete(key: string): Promise<void> {
    await this.storage.delete(key);
  }

  async getReadUrl(key: string): Promise<string> {
    return this.storage.getReadUrl(key);
  }
}
