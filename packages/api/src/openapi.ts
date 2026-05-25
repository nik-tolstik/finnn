import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AUTH_COOKIE_NAME } from "./auth/session-cookie";
import { ApiErrorDto } from "./common/api-error.dto";

const OPENAPI_JSON_PATH = "/openapi.json";

export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("Finnn API")
    .setDescription("Backend API for Finnn finance tracking")
    .setVersion("0.1.0")
    .addCookieAuth(AUTH_COOKIE_NAME, undefined, AUTH_COOKIE_NAME)
    .addTag("Health")
    .addTag("Auth")
    .addTag("Workspace Invites")
    .build();

  return SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
    extraModels: [ApiErrorDto],
    operationIdFactory: (_controllerKey, methodKey) => methodKey,
  });
}

export function configureOpenApi(app: INestApplication): void {
  const document = createOpenApiDocument(app);

  SwaggerModule.setup("docs", app, document, {
    jsonDocumentUrl: OPENAPI_JSON_PATH,
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: "alpha",
    },
  });
}
