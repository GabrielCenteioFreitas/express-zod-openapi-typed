import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { z, ZodSchema, ZodType } from 'zod';
import { getGlobalErrorHandler, defaultErrorHandler } from './config';

export interface RouteSchema {
  body?: ZodType<any>;
  querystring?: ZodType<any>;
  params?: ZodType<any>;
  headers?: ZodType<any>;
  response?: Record<number, ZodType<any>>;
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
) => void | Promise<void>;

interface RouteMetadata {
  method: string;
  path: string;
  schema: RouteSchema;
}

const routesMetadata: RouteMetadata[] = [];

const createValidationMiddleware = <T extends RouteSchema>(
  schema: T
): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errorHandler = getGlobalErrorHandler() || defaultErrorHandler;

      if (schema.body) {
        const bodyResult = await schema.body.safeParseAsync(req.body);
        if (!bodyResult.success) {
          return errorHandler(bodyResult.error, req, res, 'body');
        }
        req.body = bodyResult.data;
      }

      if (schema.querystring) {
        const queryResult = await schema.querystring.safeParseAsync(req.query);
        if (!queryResult.success) {
          return errorHandler(queryResult.error, req, res, 'querystring');
        }
        req.query = queryResult.data;
      }

      if (schema.params) {
        const paramsResult = await schema.params.safeParseAsync(req.params);
        if (!paramsResult.success) {
          return errorHandler(paramsResult.error, req, res, 'params');
        }
        req.params = paramsResult.data;
      }

      if (schema.headers) {
        const headersResult = await schema.headers.safeParseAsync(req.headers);
        if (!headersResult.success) {
          return errorHandler(headersResult.error, req, res, 'headers');
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
              errorHandler(result.error, req, res, 'response');
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
    handler: TypedRequestHandler<T>
  ) => {
    if (!schema.hide) {
      routesMetadata.push({ method: method.toUpperCase(), path, schema });
    }

    const validationMiddleware = createValidationMiddleware(schema);
    expressRouter[method](path, validationMiddleware, handler as any);
  };

  const typedRouter = {
    get<T extends RouteSchema = RouteSchema>(
      path: string,
      options: { schema: T & RouteSchema },
      handler: TypedRequestHandler<T>
    ) {
      registerRoute('get', path, options.schema, handler);
      return this;
    },

    post<T extends RouteSchema = RouteSchema>(
      path: string,
      options: { schema: T & RouteSchema },
      handler: TypedRequestHandler<T>
    ) {
      registerRoute('post', path, options.schema, handler);
      return this;
    },

    put<T extends RouteSchema = RouteSchema>(
      path: string,
      options: { schema: T & RouteSchema },
      handler: TypedRequestHandler<T>
    ) {
      registerRoute('put', path, options.schema, handler);
      return this;
    },

    delete<T extends RouteSchema = RouteSchema>(
      path: string,
      options: { schema: T & RouteSchema },
      handler: TypedRequestHandler<T>
    ) {
      registerRoute('delete', path, options.schema, handler);
      return this;
    },

    patch<T extends RouteSchema = RouteSchema>(
      path: string,
      options: { schema: T & RouteSchema },
      handler: TypedRequestHandler<T>
    ) {
      registerRoute('patch', path, options.schema, handler);
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
  }) as Router & typeof typedRouter
};

export const getRoutesMetadata = () => routesMetadata;

export const createSchema = <T extends RouteSchema>(schema: T): T => schema;
