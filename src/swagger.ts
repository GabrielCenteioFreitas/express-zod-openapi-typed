import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { getRoutesMetadata } from './typed-router';
import { getOpenAPIDefaults, getDefaultResponses } from './config';
import { extractParameters } from './lib/extract-parameters';
import { zodSchemaToOpenAPISchema } from './lib/zod-to-openapi-schema';

export { zodSchemaToOpenAPISchema } from './lib/zod-to-openapi-schema';

export interface ContactObject {
  name?: string;
  url?: string;
  email?: string;
}

export interface LicenseObject {
  name: string;
  identifier?: string;
  url?: string;
}

export interface ServerVariable {
  enum?: string[];
  default: string;
  description?: string;
}

export interface ServerObject {
  url: string;
  description?: string;
  variables?: Record<string, ServerVariable>;
}

export interface ExternalDocumentationObject {
  description?: string;
  url: string;
}

export interface TagObject {
  name: string;
  description?: string;
  externalDocs?: ExternalDocumentationObject;
}

export interface SecuritySchemeApiKey {
  type: 'apiKey';
  name: string;
  in: 'query' | 'header' | 'cookie';
  description?: string;
}

export interface SecuritySchemeHttp {
  type: 'http';
  scheme: string;
  bearerFormat?: string;
  description?: string;
}

export interface OAuthFlowObject {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface SecuritySchemeOAuth2 {
  type: 'oauth2';
  flows: {
    implicit?: OAuthFlowObject;
    password?: OAuthFlowObject;
    clientCredentials?: OAuthFlowObject;
    authorizationCode?: OAuthFlowObject;
  };
  description?: string;
}

export interface SecuritySchemeOpenIdConnect {
  type: 'openIdConnect';
  openIdConnectUrl: string;
  description?: string;
}

export type SecurityScheme = 
  | SecuritySchemeApiKey 
  | SecuritySchemeHttp 
  | SecuritySchemeOAuth2 
  | SecuritySchemeOpenIdConnect;

export interface ComponentsObject {
  schemas?: Record<string, any>;
  responses?: Record<string, any>;
  parameters?: Record<string, any>;
  examples?: Record<string, any>;
  requestBodies?: Record<string, any>;
  headers?: Record<string, any>;
  securitySchemes?: Record<string, SecurityScheme>;
  links?: Record<string, any>;
  callbacks?: Record<string, any>;
}

export interface WebhookObject {
  [method: string]: {
    summary?: string;
    description?: string;
    operationId?: string;
    tags?: string[];
    requestBody?: any;
    responses?: Record<string, any>;
  };
}

export interface OpenAPIConfig {
  info: {
    title: string;
    description?: string;
    version: string;
    termsOfService?: string;
    contact?: ContactObject;
    license?: LicenseObject;
    summary?: string;
  };
  servers?: ServerObject[];
  tags?: TagObject[];
  externalDocs?: ExternalDocumentationObject;
  security?: Array<Record<string, string[]>>;
  components?: ComponentsObject;
  webhooks?: Record<string, WebhookObject>;
  jsonSchemaDialect?: string;
}

export const generateOpenAPISpec = (config: OpenAPIConfig, basePath: string = '') => {
  const registry = new OpenAPIRegistry();
  const routes = getRoutesMetadata();
  const defaults = getOpenAPIDefaults();

  routes.forEach(({ method, path, schema }) => {
    const fullPath = `${basePath}${path}`.replace(/\/:([^/]+)/g, '/{$1}');

    const parameters: any[] = [
      ...extractParameters(schema.params, 'path'),
      ...extractParameters(schema.querystring, 'query'),
      ...extractParameters(schema.headers, 'header'),
    ];
    
    const request: any = {};
    
    if (schema.files) {
      const properties: any = {};
      const required: string[] = [];

      Object.entries(schema.files).forEach(([fieldName, config]) => {
        properties[fieldName] = {
          type: 'string',
          format: 'binary',
          description: config.description,
        };
        if (config.required) {
          required.push(fieldName);
        }
      });

      if (schema.body) {
        const bodySchema = schema.body as any;
        const def = bodySchema._def || bodySchema.def;
        if (def?.typeName === 'ZodObject' || def?.type === 'object') {
          const shape = typeof def.shape === 'function' ? def.shape() : def.shape;
          Object.entries(shape).forEach(([key, value]: [string, any]) => {
            properties[key] = zodSchemaToOpenAPISchema(value);
            const isOptional = value.isOptional && value.isOptional();
            if (!isOptional) {
              required.push(key);
            }
          });
        }
      }

      request.body = {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties,
              ...(required.length > 0 && { required }),
            },
          },
        },
      };
    } else if (schema.body) {
      request.body = {
        content: {
          'application/json': {
            schema: schema.body,
          },
        },
      };
    }

    const responses: any = {};
    const defaultResponses = getDefaultResponses();

    if (defaultResponses) {
      Object.entries(defaultResponses).forEach(([statusCode, zodSchema]) => {
        responses[statusCode] = {
          description: `Response ${statusCode}`,
          content: {
            'application/json': {
              schema: zodSchema,
            },
          },
        };
      });
    }
    
    if (schema.response) {
      Object.entries(schema.response).forEach(([statusCode, zodSchema]) => {
        responses[statusCode] = {
          description: `Response ${statusCode}`,
          content: {
            'application/json': {
              schema: zodSchema,
            },
          },
        };
      });
    } else if (!defaultResponses) {
      responses['200'] = {
        description: 'Successful response',
      };
    }

    registry.registerPath({
      method: method.toLowerCase() as any,
      path: fullPath,
      summary: schema.summary,
      description: schema.description,
      tags: schema.tags,
      operationId: schema.operationId,
      deprecated: schema.deprecated,
      security: schema.security,
      ...(parameters.length > 0 && { parameters }),
      ...(Object.keys(request).length > 0 && { request }),
      responses,
    });
  });

  const generator = new OpenApiGeneratorV31(registry.definitions);
  
  const servers = config.servers || defaults?.servers || [{ url: 'http://localhost:3000' }];
  const tags = config.tags || defaults?.tags || [];

  const document: any = {
    openapi: '3.1.0',
    info: config.info,
    servers,
    tags,
  };

  if (config.externalDocs) {
    document.externalDocs = config.externalDocs;
  }

  if (config.security) {
    document.security = config.security;
  }

  if (config.components) {
    document.components = config.components;
  }

  if (config.webhooks) {
    document.webhooks = config.webhooks;
  }

  if (config.jsonSchemaDialect) {
    document.jsonSchemaDialect = config.jsonSchemaDialect;
  }

  const generatedDoc = generator.generateDocument(document);

  if (config.components) {
    const mergedComponents: any = {
      ...generatedDoc.components,
    };

    Object.keys(config.components).forEach((key) => {
      if (typeof config.components![key as keyof ComponentsObject] === 'object') {
        mergedComponents[key] = {
          ...mergedComponents[key],
          ...config.components![key as keyof ComponentsObject],
        };
      } else {
        mergedComponents[key] = config.components![key as keyof ComponentsObject];
      }
    });

    generatedDoc.components = mergedComponents;
  }

  if (config.security) {
    (generatedDoc as any).security = config.security;
  }

  if (config.webhooks) {
    (generatedDoc as any).webhooks = {
      ...(generatedDoc as any).webhooks,
      ...config.webhooks,
    };
  }

  if (config.externalDocs) {
    (generatedDoc as any).externalDocs = config.externalDocs;
  }

  if (config.jsonSchemaDialect) {
    (generatedDoc as any).jsonSchemaDialect = config.jsonSchemaDialect;
  }

  return generatedDoc;
};
