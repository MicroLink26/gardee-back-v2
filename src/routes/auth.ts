import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { isConnected } from '../middlewares/auth';
import * as auth from '../controllers/authController';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, veuillez réessayer dans 15 minutes' },
});

router.get('/check-email', auth.checkEmail);
router.post('/register', authLimiter, auth.register);
router.post('/login', authLimiter, auth.login);
router.post('/refresh', auth.refresh);
router.post('/logout', auth.logout);
router.get('/me', isConnected, auth.me);
router.get('/roles', isConnected, auth.getRoles);
router.put('/change-password', isConnected, auth.changePassword);
router.post('/forgot-password', authLimiter, auth.forgotPassword);
router.post('/reset-password', authLimiter, auth.resetPassword);

export default router;
