import { Router } from 'express';
import { isConnected } from '../middlewares/auth';
import * as users from '../controllers/userController';

const router = Router();

router.get('/me', isConnected, users.getMyProfile);
router.put('/me', isConnected, users.updateMyProfile);

router.post('/register/client', users.registerClient);

export default router;
