import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getMyPreferences,
  updateMyPreferences,
  resetHomeLayout,
} from '../controllers/preference.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', getMyPreferences);
router.put('/', updateMyPreferences);
router.post('/reset-layout', resetHomeLayout);

export default router;

