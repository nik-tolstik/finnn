import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OpenRouterClient } from "../src/ai-finance/openrouter.client";

describe("OpenRouterClient", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      OPENROUTER_API_KEY: "test-key",
      OPENROUTER_TRANSCRIPTION_MODEL: "openai/whisper-1",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it("sends audio transcription requests as JSON with base64 audio", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: "coffee 12 byn" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const transcript = await new OpenRouterClient().transcribeAudio(
      new Blob([new Uint8Array([1, 2, 3])], { type: "application/octet-stream" }),
      "voice/file_123.oga"
    );

    expect(transcript).toBe("coffee 12 byn");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/audio/transcriptions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
        }),
      })
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toEqual(
      JSON.stringify({
        model: "openai/whisper-1",
        input_audio: {
          data: "AQID",
          format: "ogg",
        },
      })
    );
  });
});
