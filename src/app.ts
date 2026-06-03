import 'dotenv/config';
import express from 'express';
import { version } from '../package.json';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import fileUpload from 'express-fileupload';

import { connectDB } from './config/db';
import { errorHandler, notFound } from './middlewares/errorHandler';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import prestataireRoutes from './routes/prestataires';
import requestRoutes from './routes/requests';
import reviewRoutes from './routes/reviews';
import adminRoutes from './routes/admin';
import categoryRoutes from './routes/categories';
import contactRoutes from './routes/contact';
import cronRoutes from './routes/cron';

const app = express();

const allowedOrigins = [
  'http://localhost:4321',  // Astro frontend dev
  'http://localhost:4322',  // Astro frontend dev (Docker)
  'http://localhost:5173',  // Vue dev
  'http://localhost:8081',  // Expo mobile dev
  'https://gardee.fr',
  'https://www.gardee.fr',
  'https://account.gardee.fr',
  'https://v2.gardee.fr',
];

app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS non autorisé'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({ limits: { fileSize: 5 * 1024 * 1024 } }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/prestataires', prestataireRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/contact', contactRoutes);
app.use('/cron', cronRoutes);

const BUILD_DATE = new Date().toISOString();
app.get('/api/health', (_req, res) => res.json({ ok: true, version, buildDate: BUILD_DATE }));

app.use(notFound);
app.use(errorHandler);

const PORT = parseInt(process.env.PORT ?? '3000', 10);

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Gardee API v2 running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('DB connection failed:', err);
    process.exit(1);
  });

export default app;
