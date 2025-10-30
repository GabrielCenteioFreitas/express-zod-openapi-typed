export { CreateTypedRouter, createSchema, getRoutesMetadata } from './typed-router';
export type { RouteSchema, TypedRequest, TypedResponse, FileFieldConfig } from './typed-router';

export { generateOpenAPISpec } from './swagger';
export type { OpenAPIConfig } from './swagger';

export { 
  setGlobalErrorHandler, 
  setOpenAPIDefaults,
  setDefaultResponses,
  defaultErrorHandler 
} from './config';
export type { 
  ErrorHandler, 
  ValidationErrorResponse, 
  OpenAPIGlobalConfig 
} from './config';

export { RequestValidationError, ResponseValidationError } from './errors';
export type { ValidationSegment } from './errors';

export { z } from './zod';
export type { ZodType, ZodSchema } from './zod';
