import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { getRoutesMetadata } from './typed-router';
import { getOpenAPIDefaults } from './config';
import { extractParameters } from './lib/extract-parameters';
import { zodSchemaToOpenAPISchema } from './lib/zod-to-openapi-schema';

export { zodSchemaToOpenAPISchema } from './lib/zod-to-openapi-schema';

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
      ...(parameters.length > 0 && { parameters }),
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
