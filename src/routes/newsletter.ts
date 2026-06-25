import { Router } from 'express';
import * as newsletter from '../controllers/newsletterController';
import * as newsletterAdmin from '../controllers/newsletterAdminController';
import { isConnected, isStaff } from '../middlewares/auth';

const router = Router();

// Public endpoints
router.post('/subscribe', newsletter.subscribeNewsletter);
router.get('/unsubscribe', newsletter.unsubscribeNewsletter);

// Admin endpoints
router.get('/subscribers', isConnected, isStaff, newsletterAdmin.getSubscribers);
router.post('/send', isConnected, isStaff, newsletterAdmin.sendNewsletter);
router.get('/history', isConnected, isStaff, newsletterAdmin.getHistory);

export default router;
