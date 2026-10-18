import { Role } from '@prisma/client';
import { Router } from 'express';
import { asyncHandler, currentUser, parseId } from '../lib/http';
import { authenticate, requireRole } from '../middleware/auth';
import * as userService from '../services/user.service';
import { userCreateSchema, userListQuery, userUpdateSchema } from '../validators/user';

const router = Router();
router.use(authenticate);

// Admins manage users; project managers can list users so they can build their teams.
router.get(
  '/',
  requireRole(Role.ADMIN, Role.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const { items, meta } = await userService.listUsers(currentUser(req), userListQuery.parse(req.query));
    res.json({ data: items, meta });
  }),
);

router.post(
  '/',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const user = await userService.createUser(userCreateSchema.parse(req.body));
    res.status(201).json({ data: user });
  }),
);

router.patch(
  '/:id',
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const user = await userService.updateUser(currentUser(req), parseId(req.params.id), userUpdateSchema.parse(req.body));
    res.json({ data: user });
  }),
);

export default router;
