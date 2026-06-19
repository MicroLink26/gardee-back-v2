import { Router } from 'express';
import { isConnected } from '../middlewares/auth';
import * as notif from '../controllers/notificationController';

const router = Router();

router.get('/', isConnected, notif.listNotifications);
router.get('/unread-count', isConnected, notif.getUnreadCount);
router.post('/:id/read', isConnected, notif.markAsRead);
router.post('/mark-all-read', isConnected, notif.markAllAsRead);
router.delete('/:id', isConnected, notif.deleteNotification);

export default router;
