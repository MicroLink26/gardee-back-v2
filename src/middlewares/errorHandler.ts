import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Route introuvable' });
}
