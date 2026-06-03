import { Request, Response, NextFunction } from 'express';
import { errorHandler, notFound } from '../errorHandler';

describe('errorHandler middlewares', () => {
  let res: Partial<Response>;
  let json: jest.Mock;
  let status: jest.Mock;

  beforeEach(() => {
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    res = { status, json };
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('errorHandler', () => {
    it('returns 500 with generic error message', () => {
      const err = new Error('Something went wrong');

      errorHandler(err, {} as Request, res as Response, jest.fn() as unknown as NextFunction);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({ error: 'Erreur interne du serveur' });
    });

    it('logs the error', () => {
      const err = new Error('boom');

      errorHandler(err, {} as Request, res as Response, jest.fn() as unknown as NextFunction);

      expect(console.error).toHaveBeenCalledWith(err);
    });
  });

  describe('notFound', () => {
    it('returns 404 with route not found message', () => {
      notFound({} as Request, res as Response);

      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({ error: 'Route introuvable' });
    });
  });
});
