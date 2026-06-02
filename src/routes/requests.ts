import { Router } from 'express';
import { isConnected, isPrestataire } from '../middlewares/auth';
import * as req from '../controllers/requestController';


const router = Router();

// Public / email-flow
router.post('/', req.createRequest);
router.get('/confirm', req.confirmRequest);
router.post('/resend', req.resendConfirmation);

// Client actions (no auth — token-based or authenticated)
router.post('/:id/client/accept-proposal', req.clientAcceptProposal);
router.get('/proposal/accept', req.clientAcceptProposalByToken);
router.get('/proposal/refuse', req.clientRefuseProposalByToken);

// Authenticated client
router.get('/mine/client', isConnected, req.listMyClientRequests);

// Authenticated prestataire
router.get('/mine', isConnected, isPrestataire, req.listMyRequests);
router.post('/:id/provider/accept', isConnected, isPrestataire, req.providerAccept);
router.patch('/:id/provider/propose', isConnected, isPrestataire, req.providerPropose);
router.post('/:id/provider/refuse', isConnected, isPrestataire, req.providerRefuse);
router.post('/:id/provider/cancel', isConnected, isPrestataire, req.providerCancel);
router.post('/:id/complete', isConnected, isPrestataire, req.markComplete);

export default router;
