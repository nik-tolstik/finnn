import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { WorkspaceModule } from "./workspace/workspace.module";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, WorkspaceModule],
  controllers: [AppController],
})
export class AppModule {}
