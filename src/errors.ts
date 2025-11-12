import { ZodError } from 'zod';
import { Request, Response } from 'express';

export type ValidationSegment = 'body' | 'query' | 'querystring' | 'params' | 'headers';

export class RequestValidationError extends Error {
  public readonly segment: ValidationSegment;
  public readonly validationError: ZodError;
  public readonly request: Request;

  constructor(segment: ValidationSegment, validationError: ZodError, request: Request) {
    super(`Request validation failed in ${segment}`);
    this.name = 'RequestValidationError';
    this.segment = segment;
    this.validationError = validationError;
    this.request = request;

    Error.captureStackTrace(this, this.constructor);
  }

  get errors() {
    return this.validationError.issues;
  }

  get fieldErrors() {
    return this.validationError.flatten().fieldErrors;
  }
}

export class ResponseValidationError extends Error {
  public readonly statusCode: number;
  public readonly validationError: ZodError;
  public readonly request: Request;
  public readonly response: Response;
  public readonly responseBody: any;

  constructor(
    statusCode: number,
    validationError: ZodError,
    request: Request,
    response: Response,
    responseBody: any
  ) {
    super(`Response validation failed for status ${statusCode}`);
    this.name = 'ResponseValidationError';
    this.statusCode = statusCode;
    this.validationError = validationError;
    this.request = request;
    this.response = response;
    this.responseBody = responseBody;

    Error.captureStackTrace(this, this.constructor);
  }

  get errors() {
    return this.validationError.issues;
  }

  get fieldErrors() {
    return this.validationError.flatten().fieldErrors;
  }
}
