import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, forbidden, notFound } from '../lib/errors';
import { AuthUser } from '../types';

/**
 * THE central authorization rule of the app.
 *
 *  - Admin ............ can view and manage every project.
 *  - Project Manager .. can manage projects they OWN; can view projects they are a member of.
 *  - Team Member ...... can view projects they are a member of (no project management).
 *
 * If the user cannot even view the project we answer 404 (not 403) so we never
 * reveal whether a project with that id exists.
 */
export async function loadProjectAccess(user: AuthUser, projectId: number, notFoundMessage = 'Project not found') {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
    },
  });
  if (!project) throw notFound(notFoundMessage);

  const isMember = project.members.some((m) => m.userId === user.id);
  const canManage =
    user.role === Role.ADMIN || (user.role === Role.PROJECT_MANAGER && project.ownerId === user.id);

  if (!isMember && !canManage) throw notFound(notFoundMessage);
  return { project, isMember, canManage };
}

export type ProjectAccess = Awaited<ReturnType<typeof loadProjectAccess>>;

export function assertCanManage(access: ProjectAccess, message?: string): void {
  if (!access.canManage) throw forbidden(message);
}

export function assertMember(access: ProjectAccess, userId: number): void {
  if (!access.project.members.some((m) => m.userId === userId)) {
    throw new AppError(400, 'Assignee must be a member of the project', 'INVALID_ASSIGNEE', [
      { path: 'assigneeId', message: 'Assignee must be a member of the project' },
    ]);
  }
}

// Prisma `where` fragment: "projects this user is allowed to see".
export const visibleProjectsFilter = (user: AuthUser) =>
  user.role === Role.ADMIN ? {} : { members: { some: { userId: user.id } } };
