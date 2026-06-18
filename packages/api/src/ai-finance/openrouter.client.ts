import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";

const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_AUDIO_TRANSCRIPTIONS_URL = "https://openrouter.ai/api/v1/audio/transcriptions";

type OpenRouterErrorPayload = {
  error?: {
    message?: string;
    code?: string | number;
    metadata?: {
      error_type?: string;
      provider_code?: string | number;
      provider_name?: string;
      raw?: unknown;
    };
  };
  message?: string;
};

function getOpenRouterApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new ServiceUnavailableException("OpenRouter API key is not configured");
  }

  return apiKey;
}

function getOpenRouterTextModel(): string {
  return process.env.OPENROUTER_TEXT_MODEL?.trim() || "openai/gpt-4.1-mini";
}

function getOpenRouterVisionModel(): string {
  return process.env.OPENROUTER_VISION_MODEL?.trim() || getOpenRouterTextModel();
}

function getOpenRouterTranscriptionModel(): string {
  return process.env.OPENROUTER_TRANSCRIPTION_MODEL?.trim() || "openai/gpt-4o-mini-transcribe";
}

function getOpenRouterHeaders() {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getOpenRouterApiKey()}`,
  };

  const referer = process.env.OPENROUTER_APP_REFERER?.trim();
  const title = process.env.OPENROUTER_APP_TITLE?.trim();
  if (referer) headers["HTTP-Referer"] = referer;
  if (title) headers["X-Title"] = title;

  return headers;
}

async function readOpenRouterJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new BadRequestException("OpenRouter returned an invalid JSON response");
  }
}

function getOpenRouterErrorMessage(json: unknown) {
  const payload = json as OpenRouterErrorPayload;
  const message = payload.error?.message || payload.message;
  const code = payload.error?.code;
  const metadata = payload.error?.metadata;
  const details = [
    metadata?.provider_name ? `provider: ${metadata.provider_name}` : null,
    metadata?.error_type ? `type: ${metadata.error_type}` : null,
    metadata?.provider_code ? `provider code: ${metadata.provider_code}` : null,
    metadata?.raw ? `raw: ${formatOpenRouterRawError(metadata.raw)}` : null,
  ].filter(Boolean);
  if (!message) return "";

  const summary = code ? `${message} (${code})` : message;
  return details.length ? `${summary}; ${details.join("; ")}` : summary;
}

function formatOpenRouterRawError(raw: unknown) {
  const value = typeof raw === "string" ? raw.trim() : JSON.stringify(raw);
  if (!value) return "";

  return value.length > 1000 ? `${value.slice(0, 1000)}...` : value;
}

function getAudioFormat(filename: string, mimeType: string) {
  const extension = filename.split("?")[0]?.split(".").pop()?.toLowerCase();
  if (extension === "oga" || extension === "opus") return "ogg";
  if (extension) return extension;

  const normalizedMimeType = mimeType.trim().toLowerCase();
  if (normalizedMimeType === "audio/mpeg") return "mp3";
  if (normalizedMimeType === "audio/mp4" || normalizedMimeType === "audio/x-m4a") return "m4a";
  if (normalizedMimeType === "application/ogg") return "ogg";

  return normalizedMimeType.startsWith("audio/") ? normalizedMimeType.replace("audio/", "") : "ogg";
}

@Injectable()
export class OpenRouterClient {
  async createStructuredCompletion(
    messages: unknown[],
    schema: Record<string, unknown>,
    model = getOpenRouterTextModel()
  ) {
    const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        ...getOpenRouterHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        provider: {
          require_parameters: true,
        },
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "ai_finance_extraction",
            strict: true,
            schema,
          },
        },
      }),
    });

    const json = await readOpenRouterJson(response);
    if (!response.ok) {
      const message = getOpenRouterErrorMessage(json);
      throw new BadRequestException(
        message ? `OpenRouter extraction failed: ${message}` : "OpenRouter extraction failed"
      );
    }

    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new BadRequestException("OpenRouter extraction response is missing content");
    }

    return content;
  }

  async extractReceiptFromImage(dataUrl: string, prompt: string, schema: Record<string, unknown>) {
    return this.createStructuredCompletion(
      [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      schema,
      getOpenRouterVisionModel()
    );
  }

  async transcribeAudio(file: Blob, filename: string) {
    const audioBuffer = Buffer.from(await file.arrayBuffer());

    const response = await fetch(OPENROUTER_AUDIO_TRANSCRIPTIONS_URL, {
      method: "POST",
      headers: {
        ...getOpenRouterHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getOpenRouterTranscriptionModel(),
        input_audio: {
          data: audioBuffer.toString("base64"),
          format: getAudioFormat(filename, file.type),
        },
      }),
    });

    const json = await readOpenRouterJson(response);
    if (!response.ok || typeof json?.text !== "string") {
      const message = getOpenRouterErrorMessage(json);
      throw new BadRequestException(
        message ? `OpenRouter transcription failed: ${message}` : "OpenRouter transcription failed"
      );
    }

    return json.text as string;
  }
}
