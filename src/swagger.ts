import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { getRoutesMetadata } from './typed-router';
import { getOpenAPIDefaults } from './config';

export interface OpenAPIConfig {
  info: {
    title: string;
    description?: string;
    version: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  tags?: Array<{
    name: string;
    description?: string;
  }>;
}

export const generateOpenAPISpec = (config: OpenAPIConfig, basePath: string = '') => {
  const registry = new OpenAPIRegistry();
  const routes = getRoutesMetadata();
  const defaults = getOpenAPIDefaults();

  routes.forEach(({ method, path, schema }) => {
    const fullPath = `${basePath}${path}`.replace(/\/:([^/]+)/g, '/{$1}');

    const request: any = {};
    
    if (schema.params) {
      request.params = schema.params;
    }
    
    if (schema.querystring) {
      request.query = schema.querystring;
    }
    
    if (schema.headers) {
      request.headers = schema.headers;
    }
    
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
        if (bodySchema._def?.typeName === 'ZodObject') {
          Object.entries(bodySchema.shape).forEach(([key, value]: [string, any]) => {
            properties[key] = value;
            if (!value.isOptional()) {
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
    } else {
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
      ...(Object.keys(request).length > 0 && { request }),
      responses,
    });
  });

  const generator = new OpenApiGeneratorV31(registry.definitions);
  
  const servers = config.servers || defaults?.servers || [{ url: 'http://localhost:3000' }];
  const tags = config.tags || defaults?.tags || [];

  return generator.generateDocument({
    openapi: '3.1.0',
    info: config.info,
    servers,
    tags,
  });
};
