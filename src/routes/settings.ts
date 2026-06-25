import { Router } from 'express';
import * as settings from '../controllers/settingsController';
import { isConnected, isAdmin } from '../middlewares/auth';

const router = Router();

// Public read
router.get('/', settings.getSettings);

// Admin write
router.patch('/', isConnected, isAdmin, settings.updateSettings);

export default router;
