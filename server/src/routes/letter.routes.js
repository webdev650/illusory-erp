import { Router } from 'express';
import {
  getTemplates,
  createTemplate,
  reviewTemplate,
  generateLetter,
  listLetters,
  getLetterById,
  streamLetterPdf,
  revokeLetter,
  verifyPublicLetter,
} from '../controllers/letter.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

// Public verification endpoint (No auth required)
router.get('/verify/:token', verifyPublicLetter);

// Authenticated Routes
router.use(requireAuth);

router.get('/templates', getTemplates);
router.post('/templates', requirePermission(['letter.template.manage', 'document.manage']), createTemplate);
router.post('/templates/:id/review', requirePermission(['letter.template.review', 'document.manage']), reviewTemplate);

router.get('/', listLetters);
router.post('/generate', requirePermission(['letter.generate', 'document.manage']), generateLetter);
router.get('/:id', getLetterById);
router.get('/:id/pdf', streamLetterPdf);
router.post('/:id/revoke', requirePermission(['letter.revoke', 'document.manage']), revokeLetter);

export default router;
