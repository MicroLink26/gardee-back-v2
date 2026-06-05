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
router.get('/messages/search', msg.searchMessagesByToken);                      // public — token client search
router.post('/messages/reply', msg.replyByToken);                               // public — token client
router.post('/messages/read-by-token', msg.markMessagesAsReadByToken);          // public — token client mark read
router.post('/messages/react', msg.addReactionByToken);                         // public — token client react
router.get('/messages/client-threads', isConnected, msg.listClientThreads);     // client connecté — ses fils
router.get('/messages/threads', isConnected, isPrestataire, msg.listThreads);   // prestataire — liste des fils
router.get('/:id/messages', isConnected, isPrestataire, msg.getMessages);     // prestataire — fil d'une demande
router.get('/:id/messages/search', isConnected, isPrestataire, msg.searchMessages);  // prestataire search
router.post('/:id/message', isConnected, isPrestataire, msg.sendMessage);     // prestataire — envoyer
router.post('/:id/messages/mark-read', isConnected, isPrestataire, msg.markMessagesAsRead);  // prestataire mark read
router.post('/:id/messages/react', isConnected, isPrestataire, msg.addReaction);  // prestataire react
router.post('/:id/messages/pin', isConnected, isPrestataire, msg.pinMessage);  // prestataire pin
router.post('/:id/messages/unpin', isConnected, isPrestataire, msg.unpinMessage);  // prestataire unpin
router.post('/:id/messages/edit', isConnected, msg.editMessage);  // edit own message
router.post('/:id/messages/delete', isConnected, msg.deleteMessage);  // soft delete own message
router.post('/:id/messages/forward', isConnected, msg.forwardMessage);  // forward to another request
router.get('/:id/messages/forward-targets', isConnected, msg.getForwardTargets);  // list available targets
router.post('/:id/client/message', isConnected, msg.clientSendMessage);       // client connecte — repondre

export default router;
