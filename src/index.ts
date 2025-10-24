export { CreateTypedRouter, createSchema, getRoutesMetadata } from './typed-router';
export type { RouteSchema, TypedRequest, TypedResponse } from './typed-router';

export { generateOpenAPISpec } from './swagger';
export type { OpenAPIConfig } from './swagger';

export { 
  setGlobalErrorHandler, 
  setOpenAPIDefaults,
  defaultErrorHandler 
} from './config';
export type { 
  ErrorHandler, 
  ValidationErrorResponse, 
  OpenAPIGlobalConfig 
} from './config';
