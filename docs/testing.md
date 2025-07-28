# Testing Documentation

This document provides comprehensive information about the testing setup for the NestJS MongoDB GraphQL application, specifically covering the User and Auth modules.

## Overview

The application includes a complete testing suite with:

- **Unit Tests**: Testing individual services and resolvers in isolation
- **Integration Tests**: Testing complete module interactions
- **E2E Tests**: End-to-end testing of the full application
- **Faker Integration**: Realistic test data generation

## Test Structure

```
src/
├── user/
│   ├── user.service.spec.ts          # UserService unit tests
│   ├── user.resolver.spec.ts         # UserResolver unit tests
│   └── user.integration.spec.ts      # UserModule integration tests
├── auth/
│   ├── auth.service.spec.ts          # AuthService unit tests
│   ├── auth.resolver.spec.ts         # AuthResolver unit tests
│   └── auth.integration.spec.ts      # AuthModule integration tests
└── test/
    └── setup.ts                      # Global test configuration
```

## Running Tests

### All Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test:watch

# Run tests with coverage
bun test:cov

# Run tests in debug mode
bun test:debug
```

### Specific Test Files

```bash
# Run only user service tests
bun test user.service.spec.ts

# Run only auth integration tests
bun test auth.integration.spec.ts

# Run all user module tests
bun test user/
```

### Test Coverage

```bash
# Generate coverage report
bun test:cov

# Coverage report will be available in coverage/ directory
```

## Test Data Generation with Faker

The application uses [@faker-js/faker](https://fakerjs.dev/) for generating realistic test data. This ensures tests are more robust and realistic.

### Faker Configuration

Faker is configured in `test/setup.ts` with a fixed seed for consistent test data:

```typescript
import { faker } from '@faker-js/faker';

// Configure Faker for consistent test data
faker.seed(12345); // Use a fixed seed for consistent test data
```

### Common Faker Usage Patterns

#### User Data Generation

```typescript
const createMockUser = () => ({
  _id: new Types.ObjectId(),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  email: faker.internet.email(),
  username: faker.internet.userName(),
  password: faker.internet.password(),
  phone: faker.phone.number(),
  gender: faker.helpers.arrayElement(Object.values(Gender)),
  status: faker.helpers.arrayElement(Object.values(UserStatus)),
  role: faker.helpers.arrayElement(Object.values(UserRole)),
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
});
```

#### Authentication Data

```typescript
const loginInput: LoginInput = {
  username: faker.internet.userName(),
  password: faker.internet.password({ length: 12 }),
};

const signupInput: SignupInput = {
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  email: faker.internet.email(),
  password: faker.internet.password({ length: 12 }),
};
```

#### Token Generation

```typescript
const mockTokens = {
  accessToken: faker.string.alphanumeric(64),
  refreshToken: faker.string.alphanumeric(64),
};
```

#### Pagination Data

```typescript
const paginateUserInput: PaginateUserInput = {
  page: faker.number.int({ min: 1, max: 10 }),
  limit: faker.number.int({ min: 5, max: 20 }),
  search: faker.person.firstName(),
};
```

### Benefits of Using Faker

1. **Realistic Data**: Tests use data that resembles real-world scenarios
2. **Consistent Results**: Fixed seed ensures reproducible test results
3. **Edge Case Coverage**: Random data helps catch edge cases
4. **Maintainability**: No need to maintain hardcoded test data
5. **Scalability**: Easy to generate large datasets for performance testing

## Test Types

### Unit Tests

Unit tests focus on testing individual components in isolation:

#### UserService Tests (`user.service.spec.ts`)

- **create()**: Tests user creation with password hashing
- **getUser()**: Tests user retrieval with various query parameters
- **getUsers()**: Tests paginated user listing with search functionality
- **updateUser()**: Tests user updates with and without password changes
- **softDeleteUser()**: Tests soft deletion functionality
- **queryBuilder()**: Tests query building logic

#### AuthService Tests (`auth.service.spec.ts`)

- **login()**: Tests authentication with valid/invalid credentials
- **signup()**: Tests user registration and token generation
- **refreshToken()**: Tests token refresh functionality
- **getTokens()**: Tests JWT token generation

#### Resolver Tests

- **UserResolver**: Tests GraphQL resolver methods
- **AuthResolver**: Tests authentication GraphQL operations

### Integration Tests

Integration tests test complete module interactions:

#### UserModule Integration (`user.integration.spec.ts`)

- **CRUD Operations**: Complete user lifecycle testing
- **Validation**: Database constraints and validation rules
- **Pagination**: Paginated query functionality

#### AuthModule Integration (`auth.integration.spec.ts`)

- **Authentication Flow**: Complete login/signup flow
- **Token Management**: JWT token generation and validation
- **Error Handling**: Invalid credentials and token scenarios

## Test Configuration

### Jest Configuration (`jest.config.js`)

```javascript
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.module.ts',
    '!**/*.dto.ts',
    '!**/*.schema.ts',
    // ... other exclusions
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/../test/setup.ts'],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
```

### Test Setup (`test/setup.ts`)

- Loads test environment variables
- Sets global test timeout
- Configures Faker with fixed seed
- Configures console mocking
- Provides global test hooks

## Mocking Strategy

### Database Mocking

- Uses Jest mocks for Mongoose models
- Mocks database operations without actual database connections
- Provides realistic mock data structures using Faker

### External Dependencies

- **argon2**: Mocked for password hashing operations
- **JWT**: Mocked for token generation and verification
- **ConfigService**: Mocked for environment variable access

### Service Dependencies

- Services are mocked when testing resolvers
- Dependencies are properly injected using NestJS testing utilities

## Test Data

### Mock User Data with Faker

```typescript
const createMockUser = () => ({
  _id: new Types.ObjectId(),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  email: faker.internet.email(),
  username: faker.internet.userName(),
  password: faker.internet.password(),
  phone: faker.phone.number(),
  gender: faker.helpers.arrayElement(Object.values(Gender)),
  status: faker.helpers.arrayElement(Object.values(UserStatus)),
  role: faker.helpers.arrayElement(Object.values(UserRole)),
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
});
```

### Mock Tokens with Faker

```typescript
const mockTokens = {
  accessToken: faker.string.alphanumeric(64),
  refreshToken: faker.string.alphanumeric(64),
};
```

## Best Practices

### Test Organization

1. **Describe blocks**: Group related tests
2. **Clear test names**: Use descriptive test names
3. **Setup/Teardown**: Use beforeEach/afterEach for cleanup
4. **Mock isolation**: Reset mocks between tests
5. **Faker usage**: Use consistent data generation patterns

### Assertions

1. **Specific assertions**: Test exact values and behaviors
2. **Error testing**: Test both success and failure scenarios
3. **Async handling**: Properly handle async operations
4. **Mock verification**: Verify that mocks were called correctly

### Code Coverage

- Aim for >80% code coverage
- Focus on business logic coverage
- Exclude configuration and DTO files from coverage

### Faker Best Practices

1. **Use fixed seeds**: Ensures consistent test results
2. **Generate realistic data**: Use appropriate Faker methods
3. **Avoid hardcoded values**: Let Faker generate test data
4. **Use helper functions**: Create reusable data generators
5. **Consider edge cases**: Use Faker's range methods for boundary testing

## Environment Setup

### Test Environment Variables

Create a `.env.test` file for test-specific configuration:

```env
MONGODB_URI=mongodb://localhost:27017/test
ACCESS_TOKEN_SECRET=test-access-secret
REFRESH_TOKEN_SECRET=test-refresh-secret
```

### Database Setup

For integration tests, ensure you have:

- MongoDB running locally or use a test database
- Proper database cleanup between tests
- Isolated test data

## Troubleshooting

### Common Issues

1. **Timeout errors**: Increase test timeout in Jest config
2. **Mock not working**: Ensure mocks are properly reset
3. **Database connection**: Check MongoDB connection for integration tests
4. **Environment variables**: Verify `.env.test` file exists
5. **Faker inconsistencies**: Check if seed is properly set

### Debug Mode

Use debug mode for troubleshooting:

```bash
bun test:debug
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: bun install
      - run: bun test:cov
```

## References

- [NestJS Testing Documentation](https://docs.nestjs.com/fundamentals/testing)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Faker.js Documentation](https://fakerjs.dev/)
- [TypeScript Testing](https://www.typescriptlang.org/docs/handbook/testing.html)
