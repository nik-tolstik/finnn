import "./common/env/load-env";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./http-exception.filter";
import { configureOpenApi } from "./openapi";

const DEFAULT_PORT = 4000;
export const API_HOST = "0.0.0.0";

export function getPort(env: NodeJS.ProcessEnv = process.env): number {
  const rawPort = env.PORT?.trim();
  if (!rawPort) return DEFAULT_PORT;

  const port = Number(rawPort);
  return Number.isInteger(port) && port > 0 ? port : DEFAULT_PORT;
}

export function getAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.API_ALLOWED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getCorsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
  return {
    credentials: true,
    origin: getAllowedOrigins(env),
  };
}

export function getValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    forbidNonWhitelisted: true,
    transform: true,
    whitelist: true,
  });
}

export function configureApp<TApp extends INestApplication>(app: TApp, env: NodeJS.ProcessEnv = process.env): TApp {
  app.enableCors(getCorsOptions(env));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(getValidationPipe());
  return app;
}

export async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  configureOpenApi(app);
  await app.listen(getPort(), API_HOST);
  return app;
}

if (require.main === module) {
  void bootstrap();
}
