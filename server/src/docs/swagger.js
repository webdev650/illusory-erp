import swaggerUi from 'swagger-ui-express';

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Illusory ERP Backend API',
    version: '1.0.0',
    description: `
      Enterprise Resource Planning (ERP) REST API for **Illusory Design Studios Pvt. Ltd.** (Bhubaneswar, Odisha, India).
      
      ### Core Architecture Standards:
      - **Authentication**: JWT stored in secure httpOnly cookie or \`Authorization: Bearer <token>\`.
      - **Monetary Unit**: Integer paise only (e.g. ₹100.00 = \`10000\` paise).
      - **Timestamps**: Stored in UTC, presented in Asia/Kolkata (IST).
      - **Standard Response Shape**: \`{ success: boolean, message: string, data?: any, errors?: string[] }\`.
      - **RBAC**: Dynamic permission keys checked server-side on every request.
    `,
    contact: {
      name: 'Illusory Design Studios Tech Team',
      email: 'tech@illusorydesignstudios.com',
      url: 'https://illusorydesignstudios.com',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1 Root',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'token',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: { type: 'object' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          errors: { type: 'array', items: { type: 'string' } },
          requestId: { type: 'string' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'superadmin1@illusorydesignstudios.com' },
          password: { type: 'string', example: 'ChangeMe@123' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  paths: {
    '/health': {
      get: {
        summary: 'Liveness health probe',
        tags: ['System'],
        security: [],
        responses: {
          200: {
            description: 'Process is alive and healthy',
          },
        },
      },
    },
    '/ready': {
      get: {
        summary: 'Readiness database probe',
        tags: ['System'],
        security: [],
        responses: {
          200: {
            description: 'Backend and MongoDB are fully ready',
          },
          503: {
            description: 'Database disconnected or unready',
          },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate user with email and password',
        tags: ['Auth'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          200: { description: 'Login successful, returns JWT token' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Get current authenticated user session and permissions',
        tags: ['Auth'],
        responses: {
          200: { description: 'User profile with role and allowed modules' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Log out user and clear auth cookies',
        tags: ['Auth'],
        responses: {
          200: { description: 'Logged out successfully' },
        },
      },
    },
    '/employees': {
      get: {
        summary: 'List employees with pagination, search, and department filter',
        tags: ['Employees'],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Paginated employee list' },
        },
      },
    },
    '/preferences': {
      get: {
        summary: 'Get user home layout, theme, and pinned modules preferences',
        tags: ['Preferences'],
        responses: {
          200: { description: 'User preferences' },
        },
      },
      put: {
        summary: 'Update user home layout and pinned module preferences',
        tags: ['Preferences'],
        responses: {
          200: { description: 'Preferences saved' },
        },
      },
    },
    '/hr/attendance/today': {
      get: {
        summary: 'Get current employee attendance status for today',
        tags: ['Attendance'],
        responses: {
          200: { description: 'Today attendance record with active clock and breaks' },
        },
      },
    },
    '/hr/attendance/check-in': {
      post: {
        summary: 'Clock in for the workday',
        tags: ['Attendance'],
        responses: {
          200: { description: 'Clock in successful' },
        },
      },
    },
    '/hr/attendance/break-in': {
      post: {
        summary: 'Start an attendance break (lunch, tea, personal)',
        tags: ['Attendance'],
        responses: {
          200: { description: 'Break started' },
        },
      },
    },
    '/hr/attendance/break-out': {
      post: {
        summary: 'End active break and resume work',
        tags: ['Attendance'],
        responses: {
          200: { description: 'Break ended' },
        },
      },
    },
    '/hr/attendance/check-out': {
      post: {
        summary: 'Clock out and calculate final work hours minus break durations',
        tags: ['Attendance'],
        responses: {
          200: { description: 'Clock out successful' },
        },
      },
    },
    '/assets': {
      get: {
        summary: 'List company assets with status and assignee filter',
        tags: ['Assets'],
        responses: {
          200: { description: 'Assets catalog' },
        },
      },
    },
  },
};

export const setupSwagger = (app) => {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Illusory ERP API Documentation',
  }));
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
};

export default setupSwagger;
