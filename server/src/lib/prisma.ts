import { PrismaClient } from '@prisma/client';

// One shared client for the whole app (it manages a connection pool).
export const prisma = new PrismaClient();
