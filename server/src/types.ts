import { Role } from '@prisma/client';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

// Lets us write `req.user` in Express handlers with full type safety.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
