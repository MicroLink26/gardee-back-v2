import { Router } from 'express';
import { isConnected, isStaff, isAdmin } from '../middlewares/auth';
import * as admin from '../controllers/adminController';

const router = Router();

router.use(isConnected, isStaff);

router.get('/users', admin.listUsers);
router.get('/pending', admin.listPendingPrestataires);
router.post('/validate/:id', admin.validateUser);

// Admin only
router.patch('/roles/:id', isAdmin, admin.updateRole);
router.delete('/users/:id', isAdmin, admin.deleteUser);

export default router;
