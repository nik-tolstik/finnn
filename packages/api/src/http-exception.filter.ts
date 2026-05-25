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

function getExceptionResponse(exception: unknown): NestErrorResponse {
  if (exception instanceof HttpException) {
    const response = exception.getResponse();
    return typeof response === "object" && response !== null
      ? (response as NestErrorResponse)
      : { message: String(response) };
  }

  return { message: "Internal server error" };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = getExceptionResponse(exception);

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
