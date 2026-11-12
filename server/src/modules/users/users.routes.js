import { Router } from 'express';
import { protect } from '../../middleware/auth.js';
const router = Router();
// Placeholder — users module will be expanded later
router.get('/', protect, (req, res) => res.json({ success: true, data: [] }));
export default router;
