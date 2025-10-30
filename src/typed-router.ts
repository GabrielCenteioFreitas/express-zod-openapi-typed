import { Router, Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';
import { z, ZodSchema, ZodType } from './zod';
import { getGlobalErrorHandler, defaultErrorHandler } from './config';
import { RequestValidationError, ResponseValidationError } from './errors';

export type FileFieldConfig = {
  maxCount?: number;
  required?: boolean;
  description?: string;
};

export interface RouteSchema {
  body?: ZodType<any>;
  querystring?: ZodType<any>;
  params?: ZodType<any>;
  headers?: ZodType<any>;
  response?: Record<number, ZodType<any>>;
  files?: Record<string, FileFieldConfig>;
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  deprecated?: boolean;
  hide?: boolean;
  security?: Array<Record<string, string[]>>;
  externalDocs?: {
    description?: string;
    url: string;
  };
}

export interface RouteOptions<T extends RouteSchema> {
  schema: T & RouteSchema;
  errorHandler?: ErrorRequestHandler;
}

type InferSchemaTypes<T extends RouteSchema> = {
  Body: T['body'] extends ZodType ? z.infer<T['body']> : unknown;
  Querystring: T['querystring'] extends ZodType ? z.infer<T['querystring']> : unknown;
  Params: T['params'] extends ZodType ? z.infer<T['params']> : unknown;
  Headers: T['headers'] extends ZodType ? z.infer<T['headers']> : unknown;
};

export type TypedResponse<T extends RouteSchema> = Omit<Response, 'json' | 'send' | 'status'> & {
  status<S extends keyof T['response']>(code: S): TypedResponseWithStatus<T, S>;
  json: T['response'] extends Record<number, ZodType>
    ? <S extends keyof T['response']>(body: z.infer<T['response'][S]>) => Response
    : Response['json'];
  send: T['response'] extends Record<number, ZodType>
    ? <S extends keyof T['response']>(body: z.infer<T['response'][S]>) => Response
    : Response['send'];
};

type TypedResponseWithStatus<T extends RouteSchema, S extends keyof T['response']> = Omit<Response, 'json' | 'send'> & {
  json(body: z.infer<T['response'][S]>): Response;
  send(body: z.infer<T['response'][S]>): Response;
};

export type TypedRequest<T extends RouteSchema> = Request<
  InferSchemaTypes<T>['Params'],
  any,
  InferSchemaTypes<T>['Body'],
  InferSchemaTypes<T>['Querystring']
> & {
  headers: InferSchemaTypes<T>['Headers'] & Request['headers'];
};

type TypedRequestHandler<T extends RouteSchema> = (
  req: TypedRequest<T>,
  res: TypedResponse<T>
) => void | Promise<void> | Response | Promise<Response> | Promise<Response | undefined>;

interface RouteMetadata {
  method: string;
  path: string;
  schema: RouteSchema;
}

const routesMetadata: RouteMetadata[] = [];

const createValidationMiddleware = <T extends RouteSchema>(
  schema: T,
  routeErrorHandler?: ErrorRequestHandler
): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const globalErrorHandler = getGlobalErrorHandler();

      if (schema.files) {
        const files = (req as any).files || {};
        const file = (req as any).file;
        
        const missingFiles: string[] = [];
        
        Object.entries(schema.files).forEach(([fieldName, config]) => {
          const hasFile = file?.fieldname === fieldName || files[fieldName];
          
          if (config.required && !hasFile) {
            missingFiles.push(fieldName);
          }
          
          if (config.maxCount && files[fieldName]) {
            const fileArray = Array.isArray(files[fieldName]) ? files[fieldName] : [files[fieldName]];
            if (fileArray.length > config.maxCount) {
              missingFiles.push(`${fieldName} (max ${config.maxCount} files)`);
            }
          }
        });

        if (missingFiles.length > 0) {
          const zodError = new z.ZodError([
            {
              code: 'custom',
              message: `Missing required files: ${missingFiles.join(', ')}`,
              path: ['files'],
            },
          ]);
          const error = new RequestValidationError('body', zodError, req);
          if (routeErrorHandler) {
            return routeErrorHandler(error, req, res, next);
          }
          if (globalErrorHandler) {
            return globalErrorHandler(error, req, res, next);
          }
          return next(error);
        }
      }

      if (schema.body) {
        const bodyResult = await schema.body.safeParseAsync(req.body);
        if (!bodyResult.success) {
          const error = new RequestValidationError('body', bodyResult.error, req);
          if (routeErrorHandler) {
            return routeErrorHandler(error, req, res, next);
          }
          if (globalErrorHandler) {
            return globalErrorHandler(error, req, res, next);
          }
          return next(error);
        }
        req.body = bodyResult.data;
      }

      if (schema.querystring) {
        const queryResult = await schema.querystring.safeParseAsync(req.query);
        if (!queryResult.success) {
          const error = new RequestValidationError('querystring', queryResult.error, req);
          if (routeErrorHandler) {
            return routeErrorHandler(error, req, res, next);
          }
          if (globalErrorHandler) {
            return globalErrorHandler(error, req, res, next);
          }
          return next(error);
        }
        
        Object.defineProperty(req, 'query', {
          value: queryResult.data,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }

      if (schema.params) {
        const paramsResult = await schema.params.safeParseAsync(req.params);
        if (!paramsResult.success) {
          const error = new RequestValidationError('params', paramsResult.error, req);
          if (routeErrorHandler) {
            return routeErrorHandler(error, req, res, next);
          }
          if (globalErrorHandler) {
            return globalErrorHandler(error, req, res, next);
          }
          return next(error);
        }

        Object.defineProperty(req, 'params', {
          value: paramsResult.data,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }

      if (schema.headers) {
        const headersResult = await schema.headers.safeParseAsync(req.headers);
        if (!headersResult.success) {
          const error = new RequestValidationError('headers', headersResult.error, req);
          if (routeErrorHandler) {
            return routeErrorHandler(error, req, res, next);
          }
          if (globalErrorHandler) {
            return globalErrorHandler(error, req, res, next);
          }
          return next(error);
        }
        Object.assign(req.headers, headersResult.data);
      }

      if (schema.response) {
        const originalJson = res.json.bind(res);
        const originalStatus = res.status.bind(res);

        let currentStatusCode = 200;

        res.status = function(code: number) {
          currentStatusCode = code;
          return originalStatus(code);
        };

        res.json = function(body: any) {
          const responseSchema = schema.response![currentStatusCode];
          if (responseSchema) {
            const result = responseSchema.safeParse(body);
            if (!result.success) {
              console.error(`Response validation failed for status ${currentStatusCode}:`, result.error.flatten());
              const error = new ResponseValidationError(currentStatusCode, result.error, req, res, body);
              if (routeErrorHandler) {
                routeErrorHandler(error, req, res, next);
                return res;
              }
              if (globalErrorHandler) {
                globalErrorHandler(error, req, res, next);
                return res;
              }
              next(error);
              return res;
            }
          }
          return originalJson(body);
        } as any;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const CreateTypedRouter = () => {
  const expressRouter = Router();

  const registerRoute = <T extends RouteSchema>(
    method: 'get' | 'post' | 'put' | 'delete' | 'patch',
    path: string,
    schema: T,
    handler: TypedRequestHandler<T>,
    errorHandler?: ErrorRequestHandler,
    middlewares?: RequestHandler[]
  ) => {
    if (!schema.hide) {
      routesMetadata.push({ method: method.toUpperCase(), path, schema });
    }

    const validationMiddleware = createValidationMiddleware(schema, errorHandler);
    const allMiddlewares = middlewares 
      ? [...middlewares, validationMiddleware]
      : [validationMiddleware];
    expressRouter[method](path, ...allMiddlewares, handler as any);
  };

  const typedRouter = {
    get(path: string, options: any, ...handlersAndMiddlewares: any[]) {
      const handler = handlersAndMiddlewares.pop() as any;
      const middlewares = handlersAndMiddlewares as RequestHandler[];
      registerRoute('get', path, options.schema, handler, options.errorHandler, middlewares);
      return this;
    },

    post(path: string, options: any, ...handlersAndMiddlewares: any[]) {
      const handler = handlersAndMiddlewares.pop() as any;
      const middlewares = handlersAndMiddlewares as RequestHandler[];
      registerRoute('post', path, options.schema, handler, options.errorHandler, middlewares);
      return this;
    },

    put(path: string, options: any, ...handlersAndMiddlewares: any[]) {
      const handler = handlersAndMiddlewares.pop() as any;
      const middlewares = handlersAndMiddlewares as RequestHandler[];
      registerRoute('put', path, options.schema, handler, options.errorHandler, middlewares);
      return this;
    },

    delete(path: string, options: any, ...handlersAndMiddlewares: any[]) {
      const handler = handlersAndMiddlewares.pop() as any;
      const middlewares = handlersAndMiddlewares as RequestHandler[];
      registerRoute('delete', path, options.schema, handler, options.errorHandler, middlewares);
      return this;
    },

    patch(path: string, options: any, ...handlersAndMiddlewares: any[]) {
      const handler = handlersAndMiddlewares.pop() as any;
      const middlewares = handlersAndMiddlewares as RequestHandler[];
      registerRoute('patch', path, options.schema, handler, options.errorHandler, middlewares);
      return this;
    },

    getRouter() {
      return expressRouter;
    },
  };

  const callable = (...args: any[]) => {
    return (expressRouter as any)(...args)
  }

  return new Proxy(callable, {
    get(_, prop) {
      if (prop in typedRouter) return (typedRouter as any)[prop]
      return (expressRouter as any)[prop]
    },
  }) as Router & TypedRouterMethods
};

export interface TypedRouterMethods {
  get<T extends RouteSchema = RouteSchema>(
    path: string,
    options: RouteOptions<T>,
    handler: TypedRequestHandler<T>
  ): TypedRouterMethods;
  get<T extends RouteSchema = RouteSchema>(
    path: string,
    options: RouteOptions<T>,
    ...handlersAndMiddlewares: [...RequestHandler[], TypedRequestHandler<T>]
  ): TypedRouterMethods;

  post<T extends RouteSchema = RouteSchema>(
    path: string,
    options: RouteOptions<T>,
    handler: TypedRequestHandler<T>
  ): TypedRouterMethods;
  post<T extends RouteSchema = RouteSchema>(
    path: string,
    options: RouteOptions<T>,
    ...handlersAndMiddlewares: [...RequestHandler[], TypedRequestHandler<T>]
  ): TypedRouterMethods;

  put<T extends RouteSchema = RouteSchema>(
    path: string,
    options: RouteOptions<T>,
    handler: TypedRequestHandler<T>
  ): TypedRouterMethods;
  put<T extends RouteSchema = RouteSchema>(
    path: string,
    options: RouteOptions<T>,
    ...handlersAndMiddlewares: [...RequestHandler[], TypedRequestHandler<T>]
  ): TypedRouterMethods;

  delete<T extends RouteSchema = RouteSchema>(
    path: string,
    options: RouteOptions<T>,
    handler: TypedRequestHandler<T>
  ): TypedRouterMethods;
  delete<T extends RouteSchema = RouteSchema>(
    path: string,
    options: RouteOptions<T>,
    ...handlersAndMiddlewares: [...RequestHandler[], TypedRequestHandler<T>]
  ): TypedRouterMethods;

  patch<T extends RouteSchema = RouteSchema>(
    path: string,
    options: RouteOptions<T>,
    handler: TypedRequestHandler<T>
  ): TypedRouterMethods;
  patch<T extends RouteSchema = RouteSchema>(
    path: string,
    options: RouteOptions<T>,
    ...handlersAndMiddlewares: [...RequestHandler[], TypedRequestHandler<T>]
  ): TypedRouterMethods;

  getRouter(): Router;
}

export const getRoutesMetadata = () => routesMetadata;

export const createSchema = <T extends RouteSchema>(schema: T): T => schema;
