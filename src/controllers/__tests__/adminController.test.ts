import { Response } from 'express';
import {
  listUsers, listPendingPrestataires, validatePrestataire,
  updateRole, deleteUser, getInsights,
} from '../adminController';
import { User } from '../../models/User';
import { Prestataire } from '../../models/Prestataire';
import { ServiceRequest } from '../../models/ServiceRequest';
import { AuthRequest } from '../../types';

jest.mock('../../models/User', () => ({
  User: {
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  },
}));

jest.mock('../../models/Prestataire', () => ({
  Prestataire: {
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    deleteOne: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

jest.mock('../../models/ServiceRequest', () => ({
  ServiceRequest: {
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  },
}));

describe('adminController', () => {
  const mockUserFind = User.find as jest.Mock;
  const mockUserFindById = User.findById as jest.Mock;
  const mockUserFindByIdAndUpdate = User.findByIdAndUpdate as jest.Mock;
  const mockUserFindByIdAndDelete = User.findByIdAndDelete as jest.Mock;
  const mockUserCount = User.countDocuments as jest.Mock;
  const mockUserAggregate = User.aggregate as jest.Mock;
  const mockPrestFind = Prestataire.find as jest.Mock;
  const mockPrestFindOne = Prestataire.findOne as jest.Mock;
  const mockPrestFindById = Prestataire.findById as jest.Mock;
  const mockPrestDeleteOne = Prestataire.deleteOne as jest.Mock;
  const mockPrestCount = Prestataire.countDocuments as jest.Mock;
  const mockSRCount = ServiceRequest.countDocuments as jest.Mock;
  const mockSRAggregate = ServiceRequest.aggregate as jest.Mock;

  let res: Partial<Response>;
  let json: jest.Mock;
  let status: jest.Mock;

  beforeEach(() => {
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    res = { status, json };
    jest.clearAllMocks();
  });

  const authReq = (overrides = {}) =>
    ({ query: {}, params: {}, body: {}, user: { _id: 'admin-id' }, ...overrides }) as unknown as AuthRequest;

  // ── listUsers ─────────────────────────────────────────────────────

  describe('listUsers', () => {
    it('returns paginated users without passwordHash', async () => {
      const items = [{ _id: 'u1', email: 'a@b.com' }];
      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue(items) }),
          }),
        }),
      });
      mockUserCount.mockResolvedValue(1);

      await listUsers(authReq(), res as Response);

      expect(json).toHaveBeenCalledWith({ items, total: 1, page: 1, pageSize: 20 });
    });

    it('filters by q and role when provided', async () => {
      mockUserFind.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }),
          }),
        }),
      });
      mockUserCount.mockResolvedValue(0);

      await listUsers(authReq({ query: { q: 'Jean', role: 'admin' } }), res as Response);

      const filter = mockUserFind.mock.calls[0][0];
      expect(filter.$or).toBeDefined();
      expect(filter.role).toBe('admin');
    });
  });

  // ── listPendingPrestataires ───────────────────────────────────────

  describe('listPendingPrestataires', () => {
    it('returns pending prestataires with embedded user object', async () => {
      const userObj = { _id: 'uid', email: 'p@b.com' };
      const prest = {
        _id: 'pid',
        userId: { toObject: () => userObj },
        toObject: () => ({ _id: 'pid', prestations: ['Tonte'] }),
      };
      mockPrestFind.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([prest]) }),
          }),
        }),
      });
      mockPrestCount.mockResolvedValue(1);

      await listPendingPrestataires(authReq(), res as Response);

      const { items } = json.mock.calls[0][0];
      expect(items[0]).toMatchObject({ _id: 'uid', isPrestataire: true });
    });

    it('falls back to raw userId when toObject is absent', async () => {
      const prest = {
        _id: 'pid',
        userId: { _id: 'uid', email: 'p@b.com' },
        toObject: () => ({}),
      };
      mockPrestFind.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([prest]) }),
          }),
        }),
      });
      mockPrestCount.mockResolvedValue(1);

      await listPendingPrestataires(authReq(), res as Response);

      expect(json).toHaveBeenCalled();
    });

    it('filters by q when provided', async () => {
      mockPrestFind.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }),
          }),
        }),
      });
      mockPrestCount.mockResolvedValue(0);

      await listPendingPrestataires(authReq({ query: { q: 'Lyon' } }), res as Response);

      const filter = mockPrestFind.mock.calls[0][0];
      expect(filter.$or).toBeDefined();
    });
  });

  // ── validatePrestataire ───────────────────────────────────────────

  describe('validatePrestataire', () => {
    it('returns 404 when prestataire not found by userId or id', async () => {
      mockPrestFindOne.mockResolvedValue(null);
      mockPrestFindById.mockResolvedValue(null);

      await validatePrestataire(authReq({ params: { id: 'uid' } }), res as Response);

      expect(status).toHaveBeenCalledWith(404);
    });

    it('validates by userId', async () => {
      const prest = { is_validated: false, save: jest.fn() };
      mockPrestFindOne.mockResolvedValue(prest);

      await validatePrestataire(authReq({ params: { id: 'uid' } }), res as Response);

      expect(prest.is_validated).toBe(true);
      expect(prest.save).toHaveBeenCalled();
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });

    it('validates by Prestataire._id when userId lookup fails', async () => {
      const prest = { is_validated: false, save: jest.fn() };
      mockPrestFindOne.mockResolvedValue(null);
      mockPrestFindById.mockResolvedValue(prest);

      await validatePrestataire(authReq({ params: { id: 'pid' } }), res as Response);

      expect(prest.is_validated).toBe(true);
    });
  });

  // ── updateRole ────────────────────────────────────────────────────

  describe('updateRole', () => {
    it('returns 400 for an invalid role', async () => {
      await updateRole(authReq({ body: { role: 'superadmin' } }), res as Response);
      expect(status).toHaveBeenCalledWith(400);
    });

    it('returns 404 when user not found', async () => {
      mockUserFindByIdAndUpdate.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
      await updateRole(authReq({ params: { id: 'uid' }, body: { role: 'staff' } }), res as Response);
      expect(status).toHaveBeenCalledWith(404);
    });

    it('updates the role and returns the user', async () => {
      const user = { _id: 'uid', role: 'staff' };
      mockUserFindByIdAndUpdate.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

      await updateRole(authReq({ params: { id: 'uid' }, body: { role: 'staff' } }), res as Response);

      expect(json).toHaveBeenCalledWith({ ok: true, user });
    });
  });

  // ── deleteUser ────────────────────────────────────────────────────

  describe('deleteUser', () => {
    it('returns 404 when user not found', async () => {
      mockUserFindByIdAndDelete.mockResolvedValue(null);
      await deleteUser(authReq({ params: { id: 'uid' } }), res as Response);
      expect(status).toHaveBeenCalledWith(404);
    });

    it('deletes user and associated prestataire profile', async () => {
      mockUserFindByIdAndDelete.mockResolvedValue({ _id: 'uid' });
      mockPrestDeleteOne.mockResolvedValue({});

      await deleteUser(authReq({ params: { id: 'uid' } }), res as Response);

      expect(mockPrestDeleteOne).toHaveBeenCalledWith({ userId: 'uid' });
      expect(json).toHaveBeenCalledWith({ ok: true });
    });
  });

  // ── getInsights ───────────────────────────────────────────────────

  describe('getInsights', () => {
    const mockAggregate = (data: unknown[] = []) => data;

    beforeEach(() => {
      mockUserCount.mockResolvedValue(10);
      mockPrestCount.mockResolvedValue(5);
      mockSRCount.mockResolvedValue(20);
      mockUserAggregate.mockResolvedValue([{ _id: '2025-06-01', count: 3 }]);
      mockSRAggregate.mockResolvedValue([{ _id: 'scheduled', count: 5 }]);
    });

    it('returns KPIs and daily series for ≤30 days', async () => {
      await getInsights(authReq({ query: { days: '7' } }), res as Response);

      const result = json.mock.calls[0][0];
      expect(result.granularity).toBe('day');
      expect(result.kpis.totalUsers).toBe(10);
      expect(result.series.users).toEqual([{ date: '2025-06-01', count: 3 }]);
    });

    it('uses weekly granularity for 31–90 days', async () => {
      await getInsights(authReq({ query: { days: '60' } }), res as Response);
      expect(json.mock.calls[0][0].granularity).toBe('week');
    });

    it('uses monthly granularity for >90 days', async () => {
      await getInsights(authReq({ query: { days: '180' } }), res as Response);
      expect(json.mock.calls[0][0].granularity).toBe('month');
    });

    it('caps days at 365', async () => {
      await getInsights(authReq({ query: { days: '9999' } }), res as Response);
      expect(json).toHaveBeenCalled();
    });

    it('defaults to 30 days when days param is absent', async () => {
      await getInsights(authReq({ query: {} }), res as Response);
      expect(json.mock.calls[0][0].granularity).toBe('day');
    });
  });
});
