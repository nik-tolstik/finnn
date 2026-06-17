import { Module } from "@nestjs/common";

import { AvatarStorageService } from "./avatar-storage.service";

@Module({
  providers: [AvatarStorageService],
  exports: [AvatarStorageService],
})
export class AvatarModule {}
