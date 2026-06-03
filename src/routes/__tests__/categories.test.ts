import express from 'express';
import request from 'supertest';

jest.mock('../../models/Category', () => ({
  Category: { find: jest.fn(), create: jest.fn(), findByIdAndDelete: jest.fn() },
}));

jest.mock('../../middlewares/auth', () => ({
  isConnected: (_req: any, _res: any, next: any) => { _req.user = { _id: 'uid', role: 'staff' }; next(); },
  isStaff: (_req: any, _res: any, next: any) => next(),
}));

import categoriesRoutes from '../categories';
import { Category } from '../../models/Category';

const app = express();
app.use(express.json());
app.use('/', categoriesRoutes);

describe('categories routes', () => {
  const mockFind = Category.find as jest.Mock;
  const mockCreate = Category.create as jest.Mock;
  const mockDelete = Category.findByIdAndDelete as jest.Mock;

  beforeEach(() => jest.clearAllMocks());

  describe('GET /', () => {
    it('returns sorted categories', async () => {
      const cats = [{ name: 'Tonte' }, { name: 'Taille' }];
      mockFind.mockReturnValue({ sort: jest.fn().mockResolvedValue(cats) });

      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(cats);
    });
  });

  describe('POST /', () => {
    it('creates a category and returns 201', async () => {
      const cat = { _id: 'cat-1', name: 'Élagage' };
      mockCreate.mockResolvedValue(cat);

      const res = await request(app).post('/').send({ name: 'Élagage', description: 'Coupe de branches' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(cat);
      expect(mockCreate).toHaveBeenCalledWith({ name: 'Élagage', description: 'Coupe de branches' });
    });
  });

  describe('DELETE /:id', () => {
    it('deletes a category and returns ok:true', async () => {
      mockDelete.mockResolvedValue({});

      const res = await request(app).delete('/cat-1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(mockDelete).toHaveBeenCalledWith('cat-1');
    });
  });
});
