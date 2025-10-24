# express-zod-openapi

Type-safe Express routes with Zod validation and automatic OpenAPI specification generation.

## ✨ Features

- **Type-safe routes** - Full TypeScript support with inferred types from Zod schemas
- **Request validation** - Automatic validation of body, query, params, and headers
- **Response validation** - Ensure your API responses match your schemas
- **OpenAPI generation** - Automatically generate OpenAPI 3.1 specs from your routes
- **Customizable error handling** - Override default validation error responses
- **Global configuration** - Set defaults for OpenAPI generation

## 📦 Installation

```bash
npm install express-zod-openapi express zod
```

```bash
npm install -D @types/express
```

## 🚀 Quick Start

```typescript
import express from 'express';
import { z } from 'zod';
import { CreateTypedRouter, generateOpenAPISpec } from 'express-zod-openapi';

const app = express();
app.use(express.json());

const router = CreateTypedRouter();

router.post('/users', {
  schema: {
    summary: 'Create a new user',
    tags: ['Users'],
    body: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
    response: {
      201: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
      }),
    },
  },
}, async (req, res) => {
  const { name, email } = req.body;
  
  res.status(201).json({
    id: '123',
    name,
    email,
  });
});

app.use('/api', router);

const spec = generateOpenAPISpec({
  info: {
    title: 'My API',
    version: '1.0.0',
  },
}, '/api');

app.listen(3000);
```

## 📚 API Reference

### `CreateTypedRouter()`

Creates a new typed router instance that extends Express Router with type-safe route methods.

```typescript
const router = CreateTypedRouter();
```

### `createSchema<T>(schema: T): T`

Optional helper function to create route schemas with proper typing. You can also define schemas inline.

```typescript
// Using createSchema helper (optional)
import { createSchema } from 'express-zod-openapi';

const schema = createSchema({
  params: z.object({ id: z.string() }),
  body: z.object({ name: z.string() }),
  response: {
    200: z.object({ success: z.boolean() }),
  },
});

router.post('/users/:id', { schema }, handler);

// Or inline (recommended)
router.post('/users/:id', {
  schema: {
    params: z.object({ id: z.string() }),
    body: z.object({ name: z.string() }),
    response: {
      200: z.object({ success: z.boolean() }),
    },
  },
}, handler);
```

### Schema Options

```typescript
{
  params: z.object({ id: z.string() }),
  querystring: z.object({ limit: z.string().optional() }),
  body: z.object({ name: z.string() }),
  headers: z.object({ authorization: z.string() }),
  response: {
    200: z.object({ success: z.boolean() }),
    404: z.object({ error: z.string() }),
  },
  summary: 'Route description',
  description: 'Detailed description',
  tags: ['Tag1', 'Tag2'],
  operationId: 'uniqueOperationId',
  deprecated: false,
  hide: false,
  security: [{ bearerAuth: [] }],
}
```

### `generateOpenAPISpec(config, basePath?)`

Generates an OpenAPI 3.1 specification from registered routes.

```typescript
const spec = generateOpenAPISpec({
  info: {
    title: 'My API',
    description: 'API description',
    version: '1.0.0',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Development' },
    { url: 'https://api.example.com', description: 'Production' },
  ],
  tags: [
    { name: 'Users', description: 'User management' },
  ],
}, '/api/v1');
```

### `setGlobalErrorHandler(handler)`

Customize how validation errors are handled globally.

```typescript
import { setGlobalErrorHandler } from 'express-zod-openapi';

setGlobalErrorHandler((error, req, res, type) => {
  return res.status(400).json({
    error: 'Validation failed',
    type: type,
    details: error.flatten(),
  });
});
```

### `setOpenAPIDefaults(defaults)`

Set global defaults for OpenAPI generation.

```typescript
import { setOpenAPIDefaults } from 'express-zod-openapi';

setOpenAPIDefaults({
  servers: [
    { url: 'http://localhost:3000', description: 'Development' },
  ],
  tags: [
    { name: 'Default', description: 'Default tag' },
  ],
});
```

## 📋 Route Schema Options

| Property | Type | Description |
|----------|------|-------------|
| `body` | `ZodType` | Validates request body |
| `querystring` | `ZodType` | Validates query parameters |
| `params` | `ZodType` | Validates route parameters |
| `headers` | `ZodType` | Validates request headers |
| `response` | `Record<number, ZodType>` | Validates response by status code |
| `summary` | `string` | Short route description for OpenAPI |
| `description` | `string` | Detailed route description for OpenAPI |
| `tags` | `string[]` | OpenAPI tags |
| `operationId` | `string` | Unique operation identifier |
| `deprecated` | `boolean` | Mark route as deprecated |
| `hide` | `boolean` | Hide route from OpenAPI spec |
| `security` | `Array<Record<string, string[]>>` | Security requirements |

## 🏷️ TypeScript Types

```typescript
import type { 
  RouteSchema, 
  TypedRequest, 
  TypedResponse,
  ErrorHandler,
  OpenAPIConfig,
  OpenAPIGlobalConfig,
  ValidationErrorResponse
} from 'express-zod-openapi';
```

## 💡 Examples

### 🔧 Complete Example

```typescript
import express from 'express';
import { z } from 'zod';
import { CreateTypedRouter, generateOpenAPISpec } from 'express-zod-openapi';

const app = express();
app.use(express.json());

const router = CreateTypedRouter();

router.post('/users', {
  schema: {
    summary: 'Add a new user',
    tags: ['Users'],
    operationId: 'addUser',
    body: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
    response: {
      201: z.object({
        userId: z.string().uuid(),
      }),
    },
  },
}, async (req, res) => {
  const { name, email } = req.body;

  // Create user logic here
  
  res.status(201).json({
    userId: crypto.randomUUID(),
  });
});

router.get('/users/:id', {
  schema: {
    summary: 'Get user by ID',
    tags: ['Users'],
    params: z.object({
      id: z.string().uuid(),
    }),
    response: {
      200: z.object({
        id: z.string().uuid(),
        name: z.string(),
        email: z.string(),
      }),
      404: z.object({
        error: z.string(),
      }),
    },
  },
}, async (req, res) => {
  const { id } = req.params;

  // Fetch user logic here
  
  res.status(200).json({
    id,
    name: 'John Doe',
    email: 'john@example.com',
  });
});

app.use('/api', router);

const spec = generateOpenAPISpec({
  info: {
    title: 'My API',
    version: '1.0.0',
  },
}, '/api');

app.listen(3000);
```

### 🌐 With Swagger UI

```typescript
import swaggerUi from 'swagger-ui-express';

const spec = generateOpenAPISpec({
  info: { title: 'My API', version: '1.0.0' },
}, '/api');

app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
```

### 🛡️ Custom Error Handler

```typescript
import { setGlobalErrorHandler } from 'express-zod-openapi';

setGlobalErrorHandler((error, req, res, type) => {
  console.error(`Validation error in ${type}:`, error);
  
  return res.status(type === 'response' ? 500 : 400).json({
    success: false,
    message: `Invalid ${type}`,
    errors: error.flatten().fieldErrors,
  });
});
```

## 📄 License

MIT
