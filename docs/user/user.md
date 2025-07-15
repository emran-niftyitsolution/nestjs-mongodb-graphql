# User Module API Documentation

## Overview

The User module provides endpoints for user management, including creation, retrieval, and listing of users. All endpoints are designed for production use and require authentication unless otherwise specified.

---

## Endpoints

### 1. Create User

- **Mutation:** `createUser(input: CreateUserInput): User`
- **Description:** Registers a new user.
- **Input:**
  - `firstName` (string, required)
  - `lastName` (string, required)
  - `email` (string, required, unique, email format)
  - `username` (string, required, unique)
  - `phone` (string, required, unique, phone format)
  - `password` (string, required, strong password)
  - `gender` (enum: MALE, FEMALE, required)
- **Output:**
  - Returns the created `User` object.
- **Auth:** Not required for registration (customize as needed).

---

### 2. Get User

- **Query:** `getUser(input: GetUserInput): User`
- **Description:** Retrieves a user by ID.
- **Input:**
  - `_id` (ObjectId, required)
- **Output:**
  - Returns the `User` object or `null` if not found.
- **Auth:** Required.

---

### 3. Get Users (Paginated)

- **Query:** `getUsers(input: PaginateUserInput): PaginatedUser`
- **Description:** Retrieves a paginated list of users with optional filters and search.
- **Input:**
  - `gender` (enum: MALE, FEMALE, optional)
  - `status` (enum: ACTIVE, INACTIVE, BANNED, DELETED, PENDING, optional)
  - `search` (string, optional)
  - `page` (int, optional, default: 1)
  - `limit` (int, optional, default: 10, max: 100)
- **Output:**
  - Returns a `PaginatedUser` object containing users and pagination info.
- **Auth:** Required.

---

## User Object Fields

- `_id`: ObjectId
- `firstName`: string
- `lastName`: string
- `email`: string
- `username`: string
- `phone`: string
- `password`: string (hashed)
- `gender`: enum (MALE, FEMALE)
- `status`: enum (ACTIVE, INACTIVE, BANNED, DELETED, PENDING)
- `createdBy`: ObjectId (nullable)
- `lastActiveAt`: Date (nullable)
- `createdAt`: Date
- `updatedAt`: Date

---

## Notes

- All mutations and queries return errors with appropriate messages and codes on failure.
- Input validation is enforced via class-validator decorators.
- Authentication is required for all queries except user registration (unless customized).
- Passwords are stored securely (never returned in API responses).
