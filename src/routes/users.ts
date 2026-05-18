import { Router } from 'express';
import { isConnected } from '../middlewares/auth';
import * as users from '../controllers/userController';

const router = Router();

// Public
router.get('/search', users.searchPrestataires);
router.get('/ranking', users.getRanking);
router.get('/:id/reviews', users.getReviews);
router.get('/:id', users.getPublicProfile);

// Client registration
router.post('/register/client', users.registerClient);

// Prestataire registration
router.post('/register/prestataire', users.registerPrestataire);

// Authenticated
router.get('/me', isConnected, users.getMyProfile);
router.put('/me', isConnected, users.updateMyProfile);

export default router;
