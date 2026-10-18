import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import projectRoutes from './routes/project.routes';
import taskRoutes from './routes/task.routes';
import userRoutes from './routes/user.routes';

// The app is built in a function (and not started here) so tests can import it without opening a port.
export function createApp() {
  const app = express();

  // Behind a reverse proxy (Render, Railway...) so req.ip and secure cookies work correctly.
  if (env.NODE_ENV === 'production') app.set('trust proxy', 1);

  app.use(helmet()); // sensible security headers
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true })); // only our frontend may call the API with cookies
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  // Request logging never includes bodies, so passwords/tokens cannot leak into logs.
  if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.get('/api/health', (_req, res) => res.json({ data: { status: 'ok' } }));
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api', notFoundHandler);

  // In production the Express server also serves the built React app (one deployment, same origin,
  // so the auth cookie works without any cross-site configuration).
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (env.NODE_ENV === 'production' && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
