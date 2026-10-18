import { Router } from 'express';
import { asyncHandler, currentUser, parseId } from '../lib/http';
import { authenticate } from '../middleware/auth';
import * as taskService from '../services/task.service';
import { commentSchema, taskCreateSchema, taskListQuery, taskUpdateSchema } from '../validators/task';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { items, meta } = await taskService.listTasks(currentUser(req), taskListQuery.parse(req.query));
    res.json({ data: items, meta });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const task = await taskService.createTask(currentUser(req), taskCreateSchema.parse(req.body));
    res.status(201).json({ data: task });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ data: await taskService.getTask(currentUser(req), parseId(req.params.id)) });
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const task = await taskService.updateTask(currentUser(req), parseId(req.params.id), taskUpdateSchema.parse(req.body));
    res.json({ data: task });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await taskService.deleteTask(currentUser(req), parseId(req.params.id));
    res.status(204).send();
  }),
);

router.post(
  '/:id/comments',
  asyncHandler(async (req, res) => {
    const { body } = commentSchema.parse(req.body);
    const comment = await taskService.addComment(currentUser(req), parseId(req.params.id), body);
    res.status(201).json({ data: comment });
  }),
);

export default router;
