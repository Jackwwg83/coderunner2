import { User, CreateUserInput, UpdateUserInput, RegisterInput, LoginCredentials } from '../../src/types';

/**
 * Test user fixtures for consistent test data
 */

export const mockUsers = {
  validUser: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    password_hash: '$2b$10$K1wUJn2JZ.v3Q5J4e3FJrOqYjcYGDmHGx.K1wUJn2JZ.v3Q5J4e3FJ',
    plan_type: 'free',
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z')
  } as User,

  adminUser: {
    id: '550e8400-e29b-41d4-a716-446655440001',
    email: 'admin@example.com',
    password_hash: '$2b$10$K1wUJn2JZ.v3Q5J4e3FJrOqYjcYGDmHGx.K1wUJn2JZ.v3Q5J4e3FK',
    plan_type: 'team',
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z')
  } as User,

  personalUser: {
    id: '550e8400-e29b-41d4-a716-446655440002',
    email: 'personal@example.com',
    password_hash: '$2b$10$K1wUJn2JZ.v3Q5J4e3FJrOqYjcYGDmHGx.K1wUJn2JZ.v3Q5J4e3FL',
    plan_type: 'personal',
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z')
  } as User
};

export const mockCreateUserInputs = {
  valid: {
    email: 'newuser@example.com',
    password_hash: '$2b$10$K1wUJn2JZ.v3Q5J4e3FJrOqYjcYGDmHGx.K1wUJn2JZ.v3Q5J4e3FJ',
    plan_type: 'free'
  } as CreateUserInput,

  withPersonalPlan: {
    email: 'personal@example.com',
    password_hash: '$2b$10$K1wUJn2JZ.v3Q5J4e3FJrOqYjcYGDmHGx.K1wUJn2JZ.v3Q5J4e3FJ',
    plan_type: 'personal'
  } as CreateUserInput,

  withTeamPlan: {
    email: 'team@example.com',
    password_hash: '$2b$10$K1wUJn2JZ.v3Q5J4e3FJrOqYjcYGDmHGx.K1wUJn2JZ.v3Q5J4e3FJ',
    plan_type: 'team'
  } as CreateUserInput
};

export const mockUpdateUserInputs = {
  email: {
    email: 'updated@example.com'
  } as UpdateUserInput,

  planType: {
    plan_type: 'personal'
  } as UpdateUserInput,

  password: {
    password_hash: '$2b$10$NewHashedPassword123456789012345678901234567890'
  } as UpdateUserInput,

  multiple: {
    email: 'updated@example.com',
    plan_type: 'personal'
  } as UpdateUserInput
};

export const mockRegisterInputs = {
  valid: {
    email: 'register@example.com',
    password: 'ValidPassword123!',
    planType: 'free'
  } as RegisterInput,

  withStrongPassword: {
    email: 'strong@example.com',
    password: 'VeryStrongPassword123!@#',
    planType: 'personal'
  } as RegisterInput,

  invalidEmail: {
    email: 'invalid-email',
    password: 'ValidPassword123!',
    planType: 'free'
  } as RegisterInput,

  weakPassword: {
    email: 'weak@example.com',
    password: '123',
    planType: 'free'
  } as RegisterInput
};

export const mockLoginCredentials = {
  valid: {
    email: 'test@example.com',
    password: 'testpassword123'
  } as LoginCredentials,

  invalidEmail: {
    email: 'nonexistent@example.com',
    password: 'testpassword123'
  } as LoginCredentials,

  invalidPassword: {
    email: 'test@example.com',
    password: 'wrongpassword'
  } as LoginCredentials,

  invalidFormat: {
    email: 'invalid-email',
    password: 'testpassword123'
  } as LoginCredentials
};

export const mockPasswords = {
  plain: 'testpassword123',
  strongPlain: 'VeryStrongPassword123!@#',
  weakPlain: '123',
  hashed: '$2b$10$K1wUJn2JZ.v3Q5J4e3FJrOqYjcYGDmHGx.K1wUJn2JZ.v3Q5J4e3FJ',
  newPlain: 'NewPassword456!',
  newHashed: '$2b$10$NewHashedPassword123456789012345678901234567890'
};

export const mockJWTPayloads = {
  validUser: {
    userId: mockUsers.validUser.id,
    email: mockUsers.validUser.email,
    planType: mockUsers.validUser.plan_type,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
  },

  expiredUser: {
    userId: mockUsers.validUser.id,
    email: mockUsers.validUser.email,
    planType: mockUsers.validUser.plan_type,
    iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
    exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago (expired)
  },

  nearExpiryUser: {
    userId: mockUsers.validUser.id,
    email: mockUsers.validUser.email,
    planType: mockUsers.validUser.plan_type,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 1800 // 30 minutes (within 24h window)
  }
};

export const createMockUser = (overrides: Partial<User> = {}): User => ({
  ...mockUsers.validUser,
  ...overrides
});

export const createMockCreateUserInput = (overrides: Partial<CreateUserInput> = {}): CreateUserInput => ({
  ...mockCreateUserInputs.valid,
  ...overrides
});

export const withoutPassword = (user: User) => {
  const { password_hash, ...userWithoutPassword } = user;
  return userWithoutPassword;
};