import "../src/common/env/load-env";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/main";
import { createOpenApiDocument } from "../src/openapi";

async function generateOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);

  const document = createOpenApiDocument(app);
  await writeFile(resolve(process.cwd(), "openapi.json"), `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
}

void generateOpenApi();
