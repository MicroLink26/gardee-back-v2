import { Router } from 'express';
import * as reviews from '../controllers/reviewController';
import { requestTokenLimiter } from '../utils/rateLimiters';

const router = Router();

router.get('/validate', requestTokenLimiter, reviews.validateRatingToken);
router.post('/submit', requestTokenLimiter, reviews.submitReview);

export default router;
