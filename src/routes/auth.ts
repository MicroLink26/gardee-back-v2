import { Router } from 'express';
import { isConnected } from '../middlewares/auth';
import * as auth from '../controllers/authController';
import {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
} from '../utils/rateLimiters';

const router = Router();

router.get('/check-email', auth.checkEmail);
router.post('/register', registerLimiter, auth.register);
router.post('/login', loginLimiter, auth.login);
router.post('/refresh', auth.refresh);
router.post('/logout', auth.logout);
router.get('/me', isConnected, auth.me);
router.get('/roles', isConnected, auth.getRoles);
router.put('/change-password', isConnected, auth.changePassword);
router.post('/forgot-password', forgotPasswordLimiter, auth.forgotPassword);
router.post('/reset-password', resetPasswordLimiter, auth.resetPassword);
router.post('/verify-email', registerLimiter, auth.verifyEmail);
router.post('/resend-verification', registerLimiter, auth.resendVerification);

export default router;
