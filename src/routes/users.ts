import { Router } from 'express';
import { isConnected } from '../middlewares/auth';
import * as users from '../controllers/userController';

const router = Router();

// Authenticated — must be declared before /:id to avoid "me" being cast as ObjectId
router.get('/me', isConnected, users.getMyProfile);
router.put('/me', isConnected, users.updateMyProfile);

// Public
router.get('/search', users.searchPrestataires);
router.get('/ranking', users.getRanking);
router.get('/:id/reviews', users.getReviews);
router.get('/:id', users.getPublicProfile);

// Client registration
router.post('/register/client', users.registerClient);

// Prestataire registration
router.post('/register/prestataire', users.registerPrestataire);

export default router;
