import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { upload } from '../middleware/upload.js';
import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
} from '../controllers/client.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('client.read'), getClients);
router.get('/:id', requirePermission('client.read'), getClientById);
router.post('/', requirePermission('client.create'), upload.single('logo'), createClient);
router.put('/:id', requirePermission('client.update'), upload.single('logo'), updateClient);
router.delete('/:id', requirePermission('client.delete'), deleteClient);

export default router;
