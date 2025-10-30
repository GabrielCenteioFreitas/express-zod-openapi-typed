export const zodSchemaToOpenAPISchema = (schema: any): any => {
  if (!schema) return undefined;
  
  const def = schema._def || schema.def;
  if (!def) return { type: 'string' };
  
  const schemaType = def.typeName || def.type;
  
  const description = schema.description || def.description;
  
  if (schemaType === 'ZodOptional' || schemaType === 'optional') {
    const innerSchema = zodSchemaToOpenAPISchema(def.innerType || def.type);
    if (description && innerSchema) {
      innerSchema.description = description;
    }
    return innerSchema;
  }
  
  if (schemaType === 'ZodNullable' || schemaType === 'nullable') {
    const innerSchema = zodSchemaToOpenAPISchema(def.innerType || def.type);
    if (innerSchema) {
      innerSchema.nullable = true;
      if (description) {
        innerSchema.description = description;
      }
    }
    return innerSchema;
  }
  
  if (schemaType === 'ZodDefault' || schemaType === 'default') {
    const innerSchema = zodSchemaToOpenAPISchema(def.innerType || def.type);
    if (innerSchema) {
      if (def.defaultValue !== undefined) {
        innerSchema.default = typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue;
      }
      if (description) {
        innerSchema.description = description;
      }
    }
    return innerSchema;
  }
  
  if (schemaType === 'ZodEffects' || schemaType === 'effects') {
    const innerSchema = zodSchemaToOpenAPISchema(def.schema);
    if (description && innerSchema) {
      innerSchema.description = description;
    }
    return innerSchema;
  }
  
  if (schemaType === 'ZodNullish' || schemaType === 'nullish') {
    const innerSchema = zodSchemaToOpenAPISchema(def.innerType || def.type);
    if (innerSchema) {
      innerSchema.nullable = true;
      if (description) {
        innerSchema.description = description;
      }
    }
    return innerSchema;
  }
  
  if (schemaType === 'ZodBranded' || schemaType === 'branded') {
    const innerSchema = zodSchemaToOpenAPISchema(def.type);
    if (description && innerSchema) {
      innerSchema.description = description;
    }
    return innerSchema;
  }
  
  if (schemaType === 'ZodReadonly' || schemaType === 'readonly') {
    const innerSchema = zodSchemaToOpenAPISchema(def.innerType || def.type);
    if (innerSchema) {
      innerSchema.readOnly = true;
      if (description) {
        innerSchema.description = description;
      }
    }
    return innerSchema;
  }
  
  if (schemaType === 'ZodCatch' || schemaType === 'catch') {
    const innerSchema = zodSchemaToOpenAPISchema(def.innerType || def.type);
    if (description && innerSchema) {
      innerSchema.description = description;
    }
    return innerSchema;
  }
  
  if (schemaType === 'ZodPipeline' || schemaType === 'pipeline') {
    const innerSchema = zodSchemaToOpenAPISchema(def.out || def.type);
    if (description && innerSchema) {
      innerSchema.description = description;
    }
    return innerSchema;
  }
  
  if (schemaType === 'ZodLazy' || schemaType === 'lazy') {
    return { type: 'object', ...(description && { description }) };
  }
  
  const result: any = {};
  
  switch (schemaType) {
    case 'ZodString':
    case 'string':
      result.type = 'string';
      if (def.checks) {
        for (const check of def.checks) {
          if (check.kind === 'uuid') result.format = 'uuid';
          if (check.kind === 'email') result.format = 'email';
          if (check.kind === 'url') result.format = 'uri';
          if (check.kind === 'datetime') result.format = 'date-time';
          if (check.kind === 'date') result.format = 'date';
          if (check.kind === 'time') result.format = 'time';
          if (check.kind === 'min') result.minLength = check.value;
          if (check.kind === 'max') result.maxLength = check.value;
          if (check.kind === 'length') {
            result.minLength = check.value;
            result.maxLength = check.value;
          }
          if (check.kind === 'regex') result.pattern = check.regex.source;
        }
      }
      break;
      
    case 'ZodNumber':
    case 'number':
      result.type = 'number';
      if (def.checks) {
        for (const check of def.checks) {
          if (check.kind === 'int') result.type = 'integer';
          if (check.kind === 'min') {
            result.minimum = check.value;
            if (!check.inclusive) result.exclusiveMinimum = true;
          }
          if (check.kind === 'max') {
            result.maximum = check.value;
            if (!check.inclusive) result.exclusiveMaximum = true;
          }
          if (check.kind === 'multipleOf') result.multipleOf = check.value;
        }
      }
      break;
      
    case 'ZodBoolean':
    case 'boolean':
      result.type = 'boolean';
      break;
      
    case 'ZodArray':
    case 'array':
      result.type = 'array';
      result.items = zodSchemaToOpenAPISchema(def.type);
      if (def.minLength) result.minItems = def.minLength.value;
      if (def.maxLength) result.maxItems = def.maxLength.value;
      break;
      
    case 'ZodObject':
    case 'object':
      result.type = 'object';
      result.properties = {};
      const shape = typeof def.shape === 'function' ? def.shape() : def.shape;
      const required: string[] = [];
      
      for (const [key, value] of Object.entries(shape)) {
        result.properties[key] = zodSchemaToOpenAPISchema(value);
        const fieldSchema = value as any;
        if (fieldSchema && fieldSchema.isOptional && !fieldSchema.isOptional()) {
          required.push(key);
        }
      }
      
      if (required.length > 0) {
        result.required = required;
      }
      break;
      
    case 'ZodEnum':
    case 'enum':
      result.type = 'string';
      result.enum = def.values;
      break;
      
    case 'ZodNativeEnum':
    case 'nativeEnum':
      result.type = 'string';
      result.enum = Object.values(def.values);
      break;
      
    case 'ZodLiteral':
    case 'literal':
      result.type = typeof def.value;
      result.enum = [def.value];
      break;
      
    case 'ZodUnion':
    case 'union':
      result.oneOf = def.options.map((option: any) => zodSchemaToOpenAPISchema(option));
      break;
      
    case 'ZodIntersection':
    case 'intersection':
      result.allOf = [
        zodSchemaToOpenAPISchema(def.left),
        zodSchemaToOpenAPISchema(def.right),
      ];
      break;
      
    case 'ZodRecord':
    case 'record':
      result.type = 'object';
      result.additionalProperties = zodSchemaToOpenAPISchema(def.valueType);
      break;
      
    case 'ZodTuple':
    case 'tuple':
      result.type = 'array';
      if (def.items && def.items.length > 0) {
        result.prefixItems = def.items.map((item: any) => zodSchemaToOpenAPISchema(item));
        result.minItems = def.items.length;
        result.maxItems = def.items.length;
      }
      break;
      
    case 'ZodDate':
    case 'date':
      result.type = 'string';
      result.format = 'date-time';
      break;
      
    case 'ZodBigInt':
    case 'bigint':
      result.type = 'integer';
      result.format = 'int64';
      break;
      
    case 'ZodNull':
    case 'null':
      result.type = 'null';
      break;
      
    case 'ZodUndefined':
    case 'undefined':
      result.type = 'null';
      break;
      
    case 'ZodVoid':
    case 'void':
      result.type = 'null';
      break;
      
    case 'ZodNever':
    case 'never':
      result.not = {};
      break;
      
    case 'ZodMap':
    case 'map':
      result.type = 'object';
      result.additionalProperties = true;
      break;
      
    case 'ZodSet':
    case 'set':
      result.type = 'array';
      result.uniqueItems = true;
      if (def.valueType) {
        result.items = zodSchemaToOpenAPISchema(def.valueType);
      }
      break;
      
    case 'ZodDiscriminatedUnion':
    case 'discriminatedUnion':
      if (def.options) {
        result.oneOf = Array.from(def.options.values()).map((option: any) => zodSchemaToOpenAPISchema(option));
        if (def.discriminator) {
          result.discriminator = { propertyName: def.discriminator };
        }
      }
      break;
      
    case 'ZodFunction':
    case 'function':
      result.type = 'object';
      result.description = description || 'Function type';
      break;
      
    case 'ZodPromise':
    case 'promise':
      return zodSchemaToOpenAPISchema(def.type);
      
    case 'ZodAny':
    case 'any':
      break;
      
    case 'ZodUnknown':
    case 'unknown':
      break;
      
    default:
      result.type = 'string';
  }
  
  if (description) {
    result.description = description;
  }
  
  return result;
};
