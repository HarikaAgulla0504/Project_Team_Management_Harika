import { Role } from '@prisma/client';
import { Router } from 'express';
import { asyncHandler, currentUser, parseId } from '../lib/http';
import { authenticate, requireRole } from '../middleware/auth';
import * as projectService from '../services/project.service';
import {
  addMemberSchema,
  projectCreateSchema,
  projectListQuery,
  projectUpdateSchema,
} from '../validators/project';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { items, meta } = await projectService.listProjects(currentUser(req), projectListQuery.parse(req.query));
    res.json({ data: items, meta });
  }),
);

router.post(
  '/',
  requireRole(Role.ADMIN, Role.PROJECT_MANAGER),
  asyncHandler(async (req, res) => {
    const project = await projectService.createProject(currentUser(req), projectCreateSchema.parse(req.body));
    res.status(201).json({ data: project });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ data: await projectService.getProject(currentUser(req), parseId(req.params.id)) });
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const project = await projectService.updateProject(
      currentUser(req),
      parseId(req.params.id),
      projectUpdateSchema.parse(req.body),
    );
    res.json({ data: project });
  }),
);

router.post(
  '/:id/members',
  asyncHandler(async (req, res) => {
    const { userId } = addMemberSchema.parse(req.body);
    const project = await projectService.addMember(currentUser(req), parseId(req.params.id), userId);
    res.status(201).json({ data: project });
  }),
);

router.delete(
  '/:id/members/:userId',
  asyncHandler(async (req, res) => {
    const project = await projectService.removeMember(
      currentUser(req),
      parseId(req.params.id),
      parseId(req.params.userId, 'userId'),
    );
    res.json({ data: project });
  }),
);

router.post(
  '/:id/archive',
  asyncHandler(async (req, res) => {
    res.json({ data: await projectService.setArchived(currentUser(req), parseId(req.params.id), true) });
  }),
);

router.post(
  '/:id/unarchive',
  asyncHandler(async (req, res) => {
    res.json({ data: await projectService.setArchived(currentUser(req), parseId(req.params.id), false) });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await projectService.deleteProject(currentUser(req), parseId(req.params.id));
    res.status(204).send();
  }),
);

export default router;
