import { Request, Response, NextFunction } from 'express';
import { RequestValidationError, ResponseValidationError } from './errors';
import { ZodType } from './zod';

export interface ValidationErrorResponse {
  message: string;
  status: string;
  errors: any;
}

export type ErrorHandler = (
  error: RequestValidationError | ResponseValidationError,
  req: Request,
  res: Response,
  next: NextFunction
) => void | Response;

export interface OpenAPIGlobalConfig {
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  tags?: Array<{
    name: string;
    description?: string;
  }>;
}

interface GlobalConfig {
  errorHandler?: ErrorHandler;
  openApiDefaults?: OpenAPIGlobalConfig;
  defaultResponses?: Record<number, ZodType<any>>;
}

const config: GlobalConfig = {};

export const setGlobalErrorHandler = (handler: ErrorHandler) => {
  config.errorHandler = handler;
};

export const setOpenAPIDefaults = (defaults: OpenAPIGlobalConfig) => {
  config.openApiDefaults = defaults;
};

export const setDefaultResponses = (responses: Record<number, ZodType<any>>) => {
  config.defaultResponses = responses;
};

export const getGlobalErrorHandler = (): ErrorHandler | undefined => {
  return config.errorHandler;
};

export const getOpenAPIDefaults = (): OpenAPIGlobalConfig | undefined => {
  return config.openApiDefaults;
};

export const getDefaultResponses = (): Record<number, ZodType<any>> | undefined => {
  return config.defaultResponses;
};

export const defaultErrorHandler: ErrorHandler = (error, req, res, next) => {
  if (error instanceof RequestValidationError) {
    const errorMessages: Record<typeof error.segment, string> = {
      body: 'Body validation failed.',
      querystring: 'Query string validation failed.',
      params: 'Params validation failed.',
      headers: 'Headers validation failed.',
    };

    return res.status(400).json({
      message: errorMessages[error.segment],
      status: 'error',
      errors: error.fieldErrors,
    });
  }

  if (error instanceof ResponseValidationError) {
    return res.status(500).json({
      message: 'Internal error: server response does not match expected schema.',
      status: 'error',
      errors: error.fieldErrors,
    });
  }
};
