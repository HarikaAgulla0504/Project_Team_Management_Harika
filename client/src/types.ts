// These mirror the JSON the API returns.
export type Role = 'ADMIN' | 'PROJECT_MANAGER' | 'TEAM_MEMBER';
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const PROJECT_STATUSES: ProjectStatus[] = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED'];
export const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
export const TASK_PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const ROLES: Role[] = ['ADMIN', 'PROJECT_MANAGER', 'TEAM_MEMBER'];

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive?: boolean;
  createdAt?: string;
}
export interface UserRef {
  id: number;
  name: string;
}
export interface Meta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export interface ApiResponse<T> {
  data: T;
  meta?: Meta;
}
export interface Progress {
  total: number;
  done: number;
  percent: number;
  byStatus: Record<TaskStatus, number>;
}
export interface Activity {
  id: number;
  action: string;
  details: Record<string, unknown> | null;
  createdAt: string;
  actor: UserRef;
}
export interface ProjectSummary {
  id: number;
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string;
  deadline: string;
  owner: UserRef;
  progress: Progress;
  _count: { members: number; tasks: number };
}
export interface ProjectDetail {
  id: number;
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string;
  deadline: string;
  archivedAt: string | null;
  owner: User;
  members: User[];
  progress: Progress;
  permissions: { canManage: boolean };
  activity: Activity[];
}
export interface TaskSummary {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  projectId: number;
  assigneeId: number | null;
  assignee: UserRef | null;
  project: { id: number; name: string };
}
export interface Comment {
  id: number;
  body: string;
  createdAt: string;
  author: UserRef;
}
export interface TaskDetail extends TaskSummary {
  createdBy: UserRef;
  comments: Comment[];
  activity: Activity[];
  permissions: { canEdit: boolean; canChangeStatus: boolean; canDelete: boolean };
}
export interface DashboardSummary {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
  overdueTasks: number;
  myOpenTasks: number;
  myTasks: {
    id: number;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: string;
    project: UserRef;
  }[];
  projectProgress: { id: number; name: string; status: ProjectStatus; deadline: string; percent: number; done: number; total: number }[];
}
