import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface ValidationErrorResponse {
  message: string;
  status: string;
  errors: any;
}

export type ErrorHandler = (
  error: ZodError,
  req: Request,
  res: Response,
  type: 'body' | 'querystring' | 'params' | 'headers' | 'response'
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
}

const config: GlobalConfig = {};

export const setGlobalErrorHandler = (handler: ErrorHandler) => {
  config.errorHandler = handler;
};

export const setOpenAPIDefaults = (defaults: OpenAPIGlobalConfig) => {
  config.openApiDefaults = defaults;
};

export const getGlobalErrorHandler = (): ErrorHandler | undefined => {
  return config.errorHandler;
};

export const getOpenAPIDefaults = (): OpenAPIGlobalConfig | undefined => {
  return config.openApiDefaults;
};

export const defaultErrorHandler: ErrorHandler = (error, req, res, type) => {
  const errorMessages: Record<typeof type, string> = {
    body: 'Body validation failed.',
    querystring: 'Query string validation failed.',
    params: 'Params validation failed.',
    headers: 'Headers validation failed.',
    response: 'Internal error: server response does not match expected schema.',
  };

  const statusCode = type === 'response' ? 500 : 400;

  return res.status(statusCode).json({
    message: errorMessages[type],
    status: 'error',
    errors: error.flatten().fieldErrors,
  });
};
