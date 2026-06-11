import { Request, Response, NextFunction } from 'express';
import { logMessageActionError } from '../utils/logger';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  logMessageActionError('errorHandler: Unhandled error', undefined, undefined, err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Route introuvable' });
}
