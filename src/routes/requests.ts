import { Router } from 'express';
import { isConnected, isPrestataire } from '../middlewares/auth';
import * as req from '../controllers/requestController';
import * as msg from '../controllers/messageController';
import {
  tokenMessageLimiter,
  sendMessageLimiter,
  getThreadLimiter,
  markReadLimiter,
  reactionLimiter,
  createRequestLimiter,
  requestTokenLimiter,
  providerActionLimiter,
  clientActionLimiter,
} from '../utils/rateLimiters';


const router = Router();

// Public / email-flow
router.post('/', createRequestLimiter, req.createRequest);
router.get('/confirm', requestTokenLimiter, req.confirmRequest);
router.post('/resend', requestTokenLimiter, req.resendConfirmation);

// Client actions (token-based or authenticated)
router.post('/:id/client/accept-proposal', isConnected, clientActionLimiter, req.clientAcceptProposal);
router.post('/:id/client/refuse-proposal', isConnected, clientActionLimiter, req.clientRefuseProposal);
router.get('/proposal/accept', requestTokenLimiter, req.clientAcceptProposalByToken);
router.get('/proposal/refuse', requestTokenLimiter, req.clientRefuseProposalByToken);

// Authenticated client
router.get('/mine/client', isConnected, req.listMyClientRequests);
router.patch('/:id/archive', isConnected, clientActionLimiter, req.archiveRequest);
router.patch('/:id/unarchive', isConnected, clientActionLimiter, req.unarchiveRequest);
router.post('/:id/labels/add', isConnected, clientActionLimiter, req.addLabel);
router.post('/:id/labels/remove', isConnected, clientActionLimiter, req.removeLabel);
router.get('/labels', isConnected, req.listLabels);

// Authenticated prestataire
router.get('/mine', isConnected, isPrestataire, req.listMyRequests);
router.post('/:id/provider/accept', isConnected, isPrestataire, providerActionLimiter, req.providerAccept);
router.patch('/:id/provider/propose', isConnected, isPrestataire, providerActionLimiter, req.providerPropose);
router.post('/:id/provider/refuse', isConnected, isPrestataire, providerActionLimiter, req.providerRefuse);
router.post('/:id/provider/cancel', isConnected, isPrestataire, providerActionLimiter, req.providerCancel);
router.post('/:id/complete', isConnected, isPrestataire, req.markComplete);

// Messaging
router.get('/messages/thread', getThreadLimiter, msg.getThreadByToken);                           // public — token client
router.get('/messages/search', getThreadLimiter, msg.searchMessagesByToken);                      // public — token client search
router.post('/messages/reply', tokenMessageLimiter, msg.replyByToken);                               // public — token client
router.post('/messages/read-by-token', markReadLimiter, msg.markMessagesAsReadByToken);          // public — token client mark read
router.post('/messages/react', reactionLimiter, msg.addReactionByToken);                         // public — token client react
router.get('/messages/unread-count', isConnected, getThreadLimiter, msg.getUnreadCount);  // tous rôles — badge non lus
router.get('/messages/client-threads', isConnected, msg.listClientThreads);     // client connecté — ses fils
router.get('/messages/threads', isConnected, isPrestataire, msg.listThreads);   // prestataire — liste des fils
router.get('/:id/messages', isConnected, isPrestataire, msg.getMessages);     // prestataire — fil d'une demande
router.get('/:id/messages/search', isConnected, isPrestataire, msg.searchMessages);  // prestataire search
router.post('/:id/message', isConnected, isPrestataire, sendMessageLimiter, msg.sendMessage);     // prestataire — envoyer
router.post('/:id/messages/mark-read', isConnected, isPrestataire, markReadLimiter, msg.markMessagesAsRead);  // prestataire mark read
router.post('/:id/messages/react', isConnected, isPrestataire, reactionLimiter, msg.addReaction);  // prestataire react
router.post('/:id/messages/pin', isConnected, isPrestataire, msg.pinMessage);  // prestataire pin
router.post('/:id/messages/unpin', isConnected, isPrestataire, msg.unpinMessage);  // prestataire unpin
router.post('/:id/messages/edit', isConnected, msg.editMessage);  // edit own message
router.post('/:id/messages/delete', isConnected, msg.deleteMessage);  // soft delete own message
router.post('/:id/messages/forward', isConnected, msg.forwardMessage);  // forward to another request
router.get('/:id/messages/forward-targets', isConnected, msg.getForwardTargets);  // list available targets
router.post('/:id/client/message', isConnected, sendMessageLimiter, msg.clientSendMessage);       // client connecte — repondre

export default router;
