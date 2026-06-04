import { Router } from 'express';
import { isConnected, isPrestataire } from '../middlewares/auth';
import * as p from '../controllers/prestataireController';

const router = Router();

// Public
router.get('/search', p.searchPrestataires);
router.get('/ranking', p.getRanking);
router.get('/all-ids', p.getAllPrestataireIds);
router.get('/:id/reviews', p.getReviews);
router.get('/:id', p.getPublicProfile);

// Registration (public — creates new account + prestataire profile)
router.post('/register', p.registerPrestataire);

// Authenticated — add prestataire profile to existing account
router.post('/me', isConnected, p.addPrestataireProfile);
router.put('/me', isConnected, isPrestataire, p.updateMyPrestataire);
router.delete('/me', isConnected, isPrestataire, p.deleteMyPrestataire);

export default router;
