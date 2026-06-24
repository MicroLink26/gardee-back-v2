import { Router } from 'express';
import * as newsletter from '../controllers/newsletterController';

const router = Router();

router.post('/subscribe', newsletter.subscribeNewsletter);
router.get('/unsubscribe', newsletter.unsubscribeNewsletter);

export default router;
