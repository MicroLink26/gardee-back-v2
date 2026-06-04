import { Router } from 'express';
import { isConnected, isStaff, isAdmin } from '../middlewares/auth';
import * as admin from '../controllers/adminController';

const router = Router();

router.use(isConnected, isStaff);

router.get('/users', admin.listUsers);
router.get('/pending', admin.listPendingPrestataires);
router.get('/insights', admin.getInsights);

// Backward compat + new route
router.post('/validate/:id', admin.validatePrestataire);
router.put('/prestataires/:id/validate', admin.validatePrestataire);
router.put('/prestataires/:id/reject', admin.rejectPrestataire);
router.post('/ping-shown/:userId', admin.markRejectionPingShown);

// Reviews moderation
router.get('/reviews/pending', admin.listPendingReviews);
router.put('/reviews/:id/approve', admin.approveReview);
router.put('/reviews/:id/reject', admin.rejectReview);

// Admin only
router.patch('/roles/:id', isAdmin, admin.updateRole);
router.delete('/users/:id', isAdmin, admin.deleteUser);

export default router;
