import { afterEach, describe, expect, it, vi } from "vitest";

import { EmailService } from "../src/email/email.service";

const originalEnv = { ...process.env };

describe("EmailService", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("sends email through Resend when an API key is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Finnn <no-reply@example.com>";
    process.env.WEB_APP_URL = "https://finnn.example";

    const result = await new EmailService().sendVerificationEmail("ada@example.com", "token", "Ada");

    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(requestInit.method).toBe("POST");
    expect(requestInit.headers).toEqual({
      Authorization: "Bearer re_test",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      from: "Finnn <no-reply@example.com>",
      to: ["ada@example.com"],
      subject: "Подтвердите ваш email",
    });
  });

  it("returns the Resend provider error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: "The sender domain is not verified" }), { status: 422 })
      );
    vi.stubGlobal("fetch", fetchMock);
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Finnn <no-reply@example.com>";

    const result = await new EmailService().sendVerificationEmail("ada@example.com", "token");

    expect(result).toEqual({ error: "Resend API error (422): The sender domain is not verified" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a configuration error when Resend settings are missing", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;

    const result = await new EmailService().sendVerificationEmail("ada@example.com", "token");

    expect(result).toEqual({ error: "Email сервис не настроен: укажите RESEND_API_KEY и EMAIL_FROM." });
  });
});
