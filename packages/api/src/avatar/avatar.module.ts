import { Module } from "@nestjs/common";

import { StorageModule } from "@/storage/storage.module";

import { AvatarStorageService } from "./avatar-storage.service";

@Module({
  imports: [StorageModule],
  providers: [AvatarStorageService],
  exports: [AvatarStorageService],
})
export class AvatarModule {}
