import { Router } from 'express';
import { isConnected } from '../middlewares/auth';
import * as users from '../controllers/userController';
import { registerLimiter, clientActionLimiter } from '../utils/rateLimiters';

const router = Router();

router.get('/me', isConnected, users.getMyProfile);
router.put('/me', isConnected, clientActionLimiter, users.updateMyProfile);

router.post('/register/client', registerLimiter, users.registerClient);

export default router;
