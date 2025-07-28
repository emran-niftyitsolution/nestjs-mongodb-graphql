import { faker } from '@faker-js/faker';
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test timeout
jest.setTimeout(30000);

// Configure Faker for consistent test data
faker.seed(12345); // Use a fixed seed for consistent test data

// Global test setup
beforeAll(async () => {
  // Any global setup before all tests
});

afterAll(async () => {
  // Any global cleanup after all tests
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
