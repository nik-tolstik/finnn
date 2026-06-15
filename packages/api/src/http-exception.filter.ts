import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";

type ErrorResponseBody = {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
};

type NestErrorResponse = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
};

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getExceptionResponse(exception: unknown): NestErrorResponse {
  if (exception instanceof HttpException) {
    const response = exception.getResponse();
    return typeof response === "object" && response !== null
      ? (response as NestErrorResponse)
      : { message: String(response) };
  }

  return { message: "Internal server error" };
}

function logServerException(exception: unknown, request: Request, status: number): void {
  if (status < 500) return;

  const requestId =
    getHeaderValue(request.headers["x-request-id"]) ??
    getHeaderValue(request.headers["x-railway-request-id"]) ??
    getHeaderValue(request.headers["cf-ray"]);
  const userAgent = getHeaderValue(request.headers["user-agent"]);

  const context = {
    method: request.method,
    path: request.url,
    requestId,
    status,
    userAgent,
  };

  if (exception instanceof Error) {
    console.error("Unhandled API exception", {
      ...context,
      message: exception.message,
      name: exception.name,
      stack: exception.stack,
    });
    return;
  }

  console.error("Unhandled API exception", {
    ...context,
    exception,
  });
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = getExceptionResponse(exception);

    logServerException(exception, request, status);

    const body: ErrorResponseBody = {
      statusCode: status,
      message: exceptionResponse.message ?? "Internal server error",
      error: exceptionResponse.error ?? HttpStatus[status] ?? "Error",
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }
}
