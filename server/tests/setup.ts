import { beforeAll, afterAll, afterEach } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-64-characters-long-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-64-characters-long-for-testing';
process.env.DATABASE_URL = ':memory:';

beforeAll(() => {
  // Global setup before all tests
});

afterAll(() => {
  // Global cleanup after all tests
});

afterEach(() => {
  // Cleanup after each test
});
