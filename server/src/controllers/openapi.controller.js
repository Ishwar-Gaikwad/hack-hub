/**
 * OpenAPI 3.0.3 Specification for HackHub DOGFOOD 2026 API
 */
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'HackHub Hackathon Management Platform API',
    version: '1.0.0',
    description: 'Comprehensive, offline-first REST API for hackathon events, submissions, judging, community voting, and webhooks under DOGFOOD 2026 specification.',
    contact: { name: 'HackHub Engineering' },
    license: { name: 'MIT' }
  },
  servers: [
    { url: 'http://localhost:5000', description: 'Local HackHub Node/Express Instance' }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Provide persistent session token via Authorization header (e.g. Authorization: Bearer <token>)'
      },
      SessionTokenHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'x-session-token',
        description: 'Alternative session authentication header'
      }
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Unauthorized' },
          message: { type: 'string', example: 'Authentication required. Missing session token.' }
        }
      },
      Event: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '65f1234567890abcdef12345' },
          name: { type: 'string', example: 'Autonomous AI Hackathon 2026' },
          description: { type: 'string' },
          startDate: { type: 'string', format: 'date-time' },
          submissionDeadline: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['draft', 'published', 'active', 'ended', 'closed'] },
          votingOpenAt: { type: 'string', format: 'date-time' },
          votingCloseAt: { type: 'string', format: 'date-time' }
        }
      },
      Project: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          eventId: { type: 'string' },
          teamId: { type: 'string' },
          trackId: { type: 'string' },
          title: { type: 'string', example: 'Agentic Code Optimizer' },
          description: { type: 'string' },
          repositoryUrl: { type: 'string', example: 'https://github.com/team/agentic-opt' },
          status: { type: 'string', enum: ['draft', 'submitted'] }
        }
      },
      Vote: {
        type: 'object',
        properties: {
          voteId: { type: 'string' },
          projectId: { type: 'string' },
          eventId: { type: 'string' }
        }
      },
      Comment: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          content: { type: 'string', maxLength: 1000 },
          author: {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              email: { type: 'string' },
              role: { type: 'string' }
            }
          },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Webhook: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          targetUrl: { type: 'string' },
          secret: { type: 'string' },
          subscribedEvents: { type: 'array', items: { type: 'string' } },
          active: { type: 'boolean' }
        }
      }
    }
  },
  paths: {
    '/health': {
      get: {
        summary: 'System health check',
        description: 'Verify server and local database connectivity.',
        responses: {
          '200': { description: 'System healthy' },
          '503': { description: 'Database disconnected' }
        }
      }
    },
    '/api/auth/register': {
      post: {
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string', minLength: 6 },
                  role: { type: 'string', enum: ['participant', 'judge', 'organizer', 'admin'] }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Registered successfully' },
          '400': { description: 'Validation failed' },
          '409': { description: 'Duplicate email' }
        }
      }
    },
    '/api/auth/login': {
      post: {
        summary: 'Authenticate and receive session token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Authentication successful' },
          '401': { description: 'Invalid credentials' }
        }
      }
    },
    '/projects': {
      get: {
        summary: 'Public project gallery (unauthenticated)',
        responses: {
          '200': { description: 'Submitted projects array' }
        }
      }
    },
    '/api/events/{eventId}/projects/{projectId}/vote': {
      post: {
        summary: 'Cast community vote for a project (T3)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'eventId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '201': { description: 'Vote recorded' },
          '400': { description: 'Voting not active or deadline passed' },
          '401': { description: 'Authentication required' },
          '409': { description: 'Duplicate vote rejected' }
        }
      },
      delete: {
        summary: 'Retract previously cast vote (T3)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'eventId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Vote retracted' },
          '400': { description: 'Voting has ended' },
          '404': { description: 'Vote record not found' }
        }
      }
    },
    '/api/events/{eventId}/ballot': {
      get: {
        summary: 'Get randomized project ballot for voting (T3)',
        parameters: [{ name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Deterministic shuffled project ballot' }
        }
      }
    },
    '/api/events/{eventId}/results': {
      get: {
        summary: 'Get community results (hidden until voting window closes) (T3)',
        parameters: [{ name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Rankings and totals or resultsHidden notice' }
        }
      }
    },
    '/api/events/{eventId}/webhooks': {
      post: {
        summary: 'Register webhook for event notifications (T4)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['targetUrl'],
                properties: {
                  targetUrl: { type: 'string' },
                  secret: { type: 'string' },
                  subscribedEvents: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Webhook registered' },
          '403': { description: 'Staff permission required' }
        }
      }
    },
    '/api/events/{eventId}/records/judging': {
      get: {
        summary: 'Download cryptographically verifiable judging record (T4)',
        parameters: [{ name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Canonical manifest and HMAC-SHA256 signature' }
        }
      }
    },
    '/embed/gallery/{eventId}': {
      get: {
        summary: 'Standalone embeddable HTML gallery for iframes (T4)',
        parameters: [{ name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Standalone HTML document' }
        }
      }
    },
    '/api/events/{eventId}/import': {
      post: {
        summary: 'Transactional bulk import of teams and projects (T4)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '201': { description: 'Bulk data imported successfully' },
          '400': { description: 'Validation failed; entire batch rejected' }
        }
      }
    },
    '/api/events/{eventId}/export/full': {
      get: {
        summary: 'Full event data archive export in JSON (T4)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'JSON event archive' }
        }
      }
    }
  }
};

/**
 * Return JSON OpenAPI specification
 * GET /api/openapi.json
 */
export function getOpenApiSpec(req, res) {
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json(openApiSpec);
}

/**
 * Render lightweight, offline-ready interactive API Documentation page
 * GET /api/docs
 */
export function getApiDocsHtml(req, res) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HackHub REST API Reference</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f1f5f9; padding: 2rem; max-width: 1000px; margin: 0 auto; line-height: 1.5; }
    h1 { color: #818cf8; font-size: 1.75rem; margin-bottom: 0.5rem; }
    p.subtitle { color: #94a3b8; font-size: 0.95rem; margin-bottom: 2rem; }
    .badge { display: inline-block; font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; margin-right: 8px; }
    .get { background: #065f46; color: #34d399; }
    .post { background: #1e3a8a; color: #60a5fa; }
    .put { background: #78350f; color: #fbbf24; }
    .delete { background: #7f1d1d; color: #f87171; }
    .endpoint-card { background: #131b2e; border: 1px solid #1e293b; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1rem; }
    .endpoint-title { display: flex; align-items: center; font-size: 0.95rem; font-family: monospace; font-weight: 600; color: #f8fafc; }
    .endpoint-desc { margin-top: 0.4rem; font-size: 0.85rem; color: #cbd5e1; }
    .raw-link { display: inline-block; margin-bottom: 1.5rem; color: #818cf8; text-decoration: none; font-size: 0.85rem; }
    .raw-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>HackHub DOGFOOD 2026 REST API</h1>
  <p class="subtitle">Complete offline documentation of HackHub core and stretch tier endpoints.</p>
  <a class="raw-link" href="/api/openapi.json" target="_blank">&rarr; Download Raw OpenAPI 3.0.3 JSON Spec</a>

  <div id="endpoints">
    ${Object.entries(openApiSpec.paths).map(([path, methods]) =>
      Object.entries(methods).map(([method, details]) => `
        <div class="endpoint-card">
          <div class="endpoint-title">
            <span class="badge ${method}">${method}</span>
            <span>${path}</span>
          </div>
          <div class="endpoint-desc">${details.summary || ''}</div>
          <div style="font-size: 0.75rem; color: #64748b; margin-top: 4px;">
            ${details.description || ''}
          </div>
        </div>
      `).join('')
    ).join('')}
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}

export default {
  openApiSpec,
  getOpenApiSpec,
  getApiDocsHtml
};
