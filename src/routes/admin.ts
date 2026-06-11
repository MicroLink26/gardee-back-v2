import { Router } from 'express';
import { isConnected, isStaff, isAdmin } from '../middlewares/auth';
import * as admin from '../controllers/adminController';
import { clientActionLimiter } from '../utils/rateLimiters';

const router = Router();

router.use(isConnected, isStaff);

router.get('/users', admin.listUsers);
router.get('/pending', admin.listPendingPrestataires);
router.get('/insights', admin.getInsights);

// Backward compat + new route
router.post('/validate/:id', clientActionLimiter, admin.validatePrestataire);
router.put('/prestataires/:id/validate', clientActionLimiter, admin.validatePrestataire);
router.put('/prestataires/:id/reject', clientActionLimiter, admin.rejectPrestataire);
router.post('/ping-shown/:userId', clientActionLimiter, admin.markRejectionPingShown);

// Reviews moderation
router.get('/reviews/pending', admin.listPendingReviews);
router.put('/reviews/:id/approve', clientActionLimiter, admin.approveReview);
router.put('/reviews/:id/reject', clientActionLimiter, admin.rejectReview);

// Admin only
router.patch('/roles/:id', isAdmin, clientActionLimiter, admin.updateRole);
router.delete('/users/:id', isAdmin, clientActionLimiter, admin.deleteUser);

export default router;
