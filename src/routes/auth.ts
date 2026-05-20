import { Router } from 'express';
import { isConnected } from '../middlewares/auth';
import * as auth from '../controllers/authController';

const router = Router();

router.post('/login', auth.login);
router.post('/refresh', auth.refresh);
router.post('/logout', auth.logout);
router.get('/me', isConnected, auth.me);
router.get('/roles', isConnected, auth.getRoles);
router.put('/change-password', isConnected, auth.changePassword);
router.post('/forgot-password', auth.forgotPassword);
router.post('/reset-password', auth.resetPassword);

export default router;
