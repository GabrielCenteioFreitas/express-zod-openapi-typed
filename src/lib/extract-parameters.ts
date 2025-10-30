import { zodSchemaToOpenAPISchema } from './zod-to-openapi-schema';

export const extractParameters = (schema: any, paramType: 'path' | 'query' | 'header') => {
  if (!schema) return [];
  
  const def = schema._def || schema.def;
  if (!def || (def.typeName !== 'ZodObject' && def.type !== 'object')) return [];
  
  const shape = typeof def.shape === 'function' ? def.shape() : def.shape;
  const parameters: any[] = [];
  
  for (const [key, value] of Object.entries(shape)) {
    const paramSchema = value as any;
    const isOptional = paramSchema.isOptional && paramSchema.isOptional();
    
    const description = paramSchema.description || (paramSchema._def || paramSchema.def)?.description;
    
    const openApiSchema = zodSchemaToOpenAPISchema(paramSchema);
    
    if (openApiSchema && openApiSchema.description) {
      delete openApiSchema.description;
    }
    
    const param: any = {
      name: key,
      in: paramType,
      required: paramType === 'path' ? true : !isOptional,
      schema: openApiSchema,
    };
    
    if (description) {
      param.description = description;
    }
    
    parameters.push(param);
  }
  
  return parameters;
};
