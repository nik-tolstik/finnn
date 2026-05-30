import { Body, Controller, type INestApplication, Post } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { IsString } from "class-validator";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import railwayConfig from "../railway.json";
import { AppModule } from "../src/app.module";
import { API_HOST, configureApp, getAllowedOrigins, getCorsOptions, getPort } from "../src/main";
import { configureOpenApi } from "../src/openapi";
import { PrismaService } from "../src/prisma/prisma.service";

class ValidationSmokeDto {
  @IsString()
  name!: string;
}

@Controller("validation-smoke")
class ValidationSmokeController {
  @Post()
  create(@Body() body: ValidationSmokeDto): ValidationSmokeDto {
    return { name: body.name };
  }
}

describe("App", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = configureApp(moduleRef.createNestApplication(), {
      API_ALLOWED_ORIGINS: "http://localhost:3000",
    } as NodeJS.ProcessEnv);
    configureOpenApi(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves health checks", async () => {
    await request(app.getHttpServer()).get("/health").expect(200).expect({ status: "ok" });
  });

  it("serves the OpenAPI document with stable operation metadata", async () => {
    const response = await request(app.getHttpServer()).get("/openapi.json").expect(200);

    expect(response.body.info.title).toBe("Finnn API");
    expect(response.body.paths["/health"].get.operationId).toBe("getHealth");
    expect(response.body.paths["/auth/login"].post.operationId).toBe("login");
    expect(response.body.components.securitySchemes.finnn_session).toMatchObject({
      in: "cookie",
      name: "finnn_session",
      type: "apiKey",
    });
  });

  it("uses the Railway-compatible listen defaults", () => {
    expect(API_HOST).toBe("0.0.0.0");
    expect(getPort({})).toBe(4000);
    expect(getPort({ PORT: "4010" })).toBe(4010);
    expect(getPort({ PORT: "not-a-port" })).toBe(4000);
  });

  it("keeps the Railway deployment config aligned with the API package scripts", () => {
    expect(railwayConfig.build).toMatchObject({
      builder: "RAILPACK",
      buildCommand: "pnpm --filter api build",
    });
    expect(railwayConfig.deploy).toMatchObject({
      startCommand: "pnpm --filter api start",
      healthcheckPath: "/health",
    });
  });

  it("enables credentialed CORS only for configured origins", () => {
    expect(getAllowedOrigins({ API_ALLOWED_ORIGINS: "http://localhost:3000, https://app.example.com" })).toEqual([
      "http://localhost:3000",
      "https://app.example.com",
    ]);
    expect(getCorsOptions({ API_ALLOWED_ORIGINS: "https://app.example.com" })).toMatchObject({
      credentials: true,
      origin: ["https://app.example.com"],
    });
  });
});

describe("Global validation", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ValidationSmokeController],
    }).compile();

    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects invalid DTO payloads with the shared error shape", async () => {
    const response = await request(app.getHttpServer())
      .post("/validation-smoke")
      .send({ name: 123, extra: "nope" })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
      path: "/validation-smoke",
    });
    expect(response.body.message).toEqual(
      expect.arrayContaining(["property extra should not exist", "name must be a string"])
    );
    expect(typeof response.body.timestamp).toBe("string");
  });
});
