import { Router } from 'express';
import { asyncHandler, currentUser } from '../lib/http';
import { authenticate } from '../middleware/auth';
import { getSummary } from '../services/dashboard.service';

const router = Router();
router.use(authenticate);

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    res.json({ data: await getSummary(currentUser(req)) });
  }),
);

export default router;
