import { Router } from 'express';
import { isConnected, isPrestataire } from '../middlewares/auth';
import * as req from '../controllers/requestController';
import * as msg from '../controllers/messageController';


const router = Router();

// Public / email-flow
router.post('/', req.createRequest);
router.get('/confirm', req.confirmRequest);
router.post('/resend', req.resendConfirmation);

// Client actions (token-based or authenticated)
router.post('/:id/client/accept-proposal', isConnected, req.clientAcceptProposal);
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

// Messaging
router.get('/messages/thread', msg.getThreadByToken);                           // public — token client
router.post('/messages/reply', msg.replyByToken);                               // public — token client
router.get('/messages/client-threads', isConnected, msg.listClientThreads);     // client connecté — ses fils
router.get('/messages/threads', isConnected, isPrestataire, msg.listThreads);   // prestataire — liste des fils
router.get('/:id/messages', isConnected, isPrestataire, msg.getMessages);     // prestataire — fil d'une demande
router.post('/:id/message', isConnected, isPrestataire, msg.sendMessage);     // prestataire — envoyer
router.post('/:id/client/message', isConnected, msg.clientSendMessage);       // client connecte — repondre

export default router;
