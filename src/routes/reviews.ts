import { Router } from 'express';
import * as reviews from '../controllers/reviewController';

const router = Router();

router.get('/validate', reviews.validateRatingToken);
router.post('/submit', reviews.submitReview);

export default router;
