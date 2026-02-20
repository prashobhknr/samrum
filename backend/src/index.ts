/**
 * Doorman API - Express.js Server
 * Phase 1: Foundation - OMS CRUD endpoints
 * 
 * Endpoints:
 * - GET /api/objects/types
 * - POST /api/objects/types
 * - GET /api/objects/types/{id}/attributes
 * - POST /api/objects/types/{id}/attributes
 * - GET /api/objects/instances
 * - POST /api/objects/instances
 * - GET /api/objects/instances/{id}/attributes
 * - POST /api/objects/instances/{id}/attributes
 * - GET /health
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const API_PORT = process.env.API_PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Info endpoint
app.get('/api', (req, res) => {
  res.json({
    service: 'Doorman API',
    version: '1.0.0',
    phase: 'Phase 1: Foundation',
    status: 'operational',
    endpoints: {
      objects: '/api/objects',
      forms: '/api/forms',
      permissions: '/api/permissions'
    }
  });
});

// TODO: Import and use routes
// import objectRoutes from './routes/objects';
// import formRoutes from './routes/forms';
// import permissionRoutes from './routes/permissions';
//
// app.use('/api/objects', objectRoutes);
// app.use('/api/forms', formRoutes);
// app.use('/api/permissions', permissionRoutes);

// Placeholder routes for Phase 1
app.get('/api/objects/types', (req, res) => {
  res.json({
    message: 'ObjectService not yet implemented',
    TODO: 'Implement ObjectService to return types from database'
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method
  });
});

// Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    path: req.path
  });
});

// Start server
app.listen(API_PORT, () => {
  console.log(`🚀 Doorman API running on http://localhost:${API_PORT}`);
  console.log(`📊 Database: ${process.env.DATABASE_URL}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV}`);
  console.log(`📍 Health check: GET http://localhost:${API_PORT}/health`);
  console.log('\n💡 Phase 1 Foundation - Ready for Phase 2 (Data Migration)');
});
