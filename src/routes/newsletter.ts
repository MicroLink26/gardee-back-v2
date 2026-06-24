import { Router } from 'express';
import * as newsletter from '../controllers/newsletterController';
import * as newsletterAdmin from '../controllers/newsletterAdminController';
import { isStaff } from '../middlewares/auth';

const router = Router();

// Public endpoints
router.post('/subscribe', newsletter.subscribeNewsletter);
router.get('/unsubscribe', newsletter.unsubscribeNewsletter);

// Admin endpoints
router.get('/subscribers', isStaff, newsletterAdmin.getSubscribers);
router.post('/send', isStaff, newsletterAdmin.sendNewsletter);
router.get('/history', isStaff, newsletterAdmin.getHistory);

export default router;
