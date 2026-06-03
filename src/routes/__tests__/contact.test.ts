import express from 'express';
import request from 'supertest';

jest.mock('../../models/Contact', () => ({
  Contact: { create: jest.fn() },
}));

import contactRoutes from '../contact';
import { Contact } from '../../models/Contact';

const app = express();
app.use(express.json());
app.use('/', contactRoutes);

describe('contact routes', () => {
  const mockCreate = Contact.create as jest.Mock;

  beforeEach(() => jest.clearAllMocks());

  describe('POST /', () => {
    const validBody = { email: 'user@example.com', name: 'Jean', message: 'Bonjour !' };

    it('returns 400 when email is invalid', async () => {
      const res = await request(app).post('/').send({ email: 'not-an-email', name: 'Jean', message: 'Hi' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    it('returns 400 when name is empty', async () => {
      const res = await request(app).post('/').send({ email: 'u@example.com', name: '', message: 'Hi' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when message is missing', async () => {
      const res = await request(app).post('/').send({ email: 'u@example.com', name: 'Jean' });

      expect(res.status).toBe(400);
    });

    it('creates contact and returns ok:true for valid body', async () => {
      mockCreate.mockResolvedValue({});

      const res = await request(app).post('/').send(validBody);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Jean', message: 'Bonjour !' }));
    });
  });
});
