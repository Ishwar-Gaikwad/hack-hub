import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import config from './config/index.js';
import healthRouter from './routes/health.routes.js';
import authRouter from './routes/auth.routes.js';
import eventRouter from './routes/event.routes.js';
import teamRouter from './routes/team.routes.js';
import inviteRouter from './routes/invite.routes.js';
import projectRouter from './routes/project.routes.js';
import judgingRouter from './routes/judging.routes.js';
import { exportCSV } from './controllers/judging.controller.js';
import { deleteComment, updateComment } from './controllers/comment.controller.js';
import { getEmbedGalleryHtml, getEmbedGalleryJson } from './controllers/embed.controller.js';
import { getOpenApiSpec, getApiDocsHtml } from './controllers/openapi.controller.js';
import { authenticate } from './middleware/auth.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security and utility middleware
app.use(cors({
  origin: config.cors.origin,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (in non-test environments)
if (!config.isTest) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
    });
    next();
  });
}

// Health check routes
app.use('/health', healthRouter);
app.use('/api/health', healthRouter);

// Authentication & role routes
app.use('/api/auth', authRouter);

// Event management routes (Events, Tracks, Prizes)
app.use('/api/events', eventRouter);

// Team formation & Invite routes
app.use('/api/teams', teamRouter);
app.use('/api/invites', inviteRouter);

// Project submission & draft routes
app.use('/projects', projectRouter);
app.use('/api/projects', projectRouter);

// Judging & Evaluation routes (T2)
app.use('/api/judge', judgingRouter);
app.get('/api/export.csv', authenticate, exportCSV);

// Project Comments moderation & deletion (T3)
app.put('/api/comments/:commentId', authenticate, updateComment);
app.put('/comments/:commentId', authenticate, updateComment);
app.delete('/api/comments/:commentId', authenticate, deleteComment);
app.delete('/comments/:commentId', authenticate, deleteComment);

// Embeddable Showcase Gallery (T4)
app.get('/embed/gallery/:eventId', getEmbedGalleryHtml);
app.get('/api/embed/gallery/:eventId', getEmbedGalleryJson);

// OpenAPI Documentation & Interactive Docs (T4)
app.get('/api/openapi.json', getOpenApiSpec);
app.get('/api/docs', getApiDocsHtml);

// Serve static frontend assets if built
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path === '/projects' ||
      req.path.startsWith('/projects/') ||
      req.path.startsWith('/embed')
    ) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  // Root fallback when frontend is not built yet
  app.get('/', (req, res) => {
    res.json({
      name: 'HackHub API',
      version: '0.1.0',
      status: 'online',
      documentation: 'Visit /api/health for system status'
    });
  });
}

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `API route ${req.originalUrl} does not exist`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred'
  });
});

export default app;
