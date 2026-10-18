import dotenv from 'dotenv';

// Runs BEFORE each test file. Load .env.test and override anything from .env,
// so tests can never touch the development database.
dotenv.config({ path: '.env.test', override: true });
process.env.NODE_ENV = 'test';
process.env.BCRYPT_ROUNDS = process.env.BCRYPT_ROUNDS ?? '4';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-test-secret-test-secret';

if (!process.env.DATABASE_URL || !/test/i.test(process.env.DATABASE_URL)) {
  throw new Error('Refusing to run tests: DATABASE_URL (from .env.test) must point to a database whose name contains "test".');
}
