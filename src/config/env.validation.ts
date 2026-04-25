import type { SignOptions } from 'jsonwebtoken';

// CJS `module.exports = fn` — default import compiles to `.default` and breaks at runtime.
import ms = require('ms');

type JwtExpiresIn = NonNullable<SignOptions['expiresIn']>;

/** Validated environment shape produced by {@link validateEnv}. */
export interface AppEnv {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  MONGODB_URI: string;
  ACCESS_TOKEN_SECRET: string;
  REFRESH_TOKEN_SECRET: string;
  ACCESS_TOKEN_EXPIRES_IN: JwtExpiresIn;
  REFRESH_TOKEN_EXPIRES_IN: JwtExpiresIn;
  /**
   * Maximum number of active (non-revoked, non-expired) sessions per user.
   * Extra sessions are revoked (oldest first) on login/signup.
   */
  MAX_ACTIVE_SESSIONS_PER_USER: number;
}

function pick(config: Record<string, unknown>, key: keyof AppEnv): unknown {
  return config[key];
}

function missing(key: keyof AppEnv): never {
  throw new Error(`Environment variable ${key} is required`);
}

function nonEmptyString(value: unknown, key: keyof AppEnv): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    missing(key);
  }
  return value.trim();
}

function nodeEnv(value: unknown): AppEnv['NODE_ENV'] {
  if (value !== 'development' && value !== 'test' && value !== 'production') {
    throw new Error(
      'Environment variable NODE_ENV must be set to development, test, or production',
    );
  }
  return value;
}

function port(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    missing('PORT');
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > 65535) {
    throw new Error('Environment variable PORT must be a valid port number');
  }
  return n;
}

function positiveIntWithDefault(
  value: unknown,
  key: keyof AppEnv,
  defaultValue: number,
): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Environment variable ${key} must be a positive integer`);
  }
  return n;
}

/** `@types/ms` expects `StringValue`; env values are plain strings at compile time. */
function durationToMillis(value: string): number | undefined {
  return (ms as unknown as (input: string) => number | undefined)(value);
}

function jwtExpiresIn(
  value: unknown,
  key: 'ACCESS_TOKEN_EXPIRES_IN' | 'REFRESH_TOKEN_EXPIRES_IN',
): JwtExpiresIn {
  if (value === undefined || value === null) {
    missing(key);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(
        `Environment variable ${key} must be a positive number (seconds)`,
      );
    }
    return value;
  }

  if (typeof value !== 'string') {
    throw new Error(`Environment variable ${key} must be a string or number`);
  }

  const s = value.trim();
  if (s.length === 0) {
    missing(key);
  }

  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error(
        `Environment variable ${key} digit-only value must be a positive integer (seconds)`,
      );
    }
    return n;
  }

  const parsed = durationToMillis(s);
  if (parsed === undefined || !Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `Environment variable ${key} must be a valid duration (e.g. 1d, 1h) or positive seconds`,
    );
  }
  return s as JwtExpiresIn;
}

export function validateEnv(config: Record<string, unknown>): AppEnv {
  return {
    NODE_ENV: nodeEnv(pick(config, 'NODE_ENV')),
    PORT: port(pick(config, 'PORT')),
    MONGODB_URI: nonEmptyString(pick(config, 'MONGODB_URI'), 'MONGODB_URI'),
    ACCESS_TOKEN_SECRET: nonEmptyString(
      pick(config, 'ACCESS_TOKEN_SECRET'),
      'ACCESS_TOKEN_SECRET',
    ),
    REFRESH_TOKEN_SECRET: nonEmptyString(
      pick(config, 'REFRESH_TOKEN_SECRET'),
      'REFRESH_TOKEN_SECRET',
    ),
    ACCESS_TOKEN_EXPIRES_IN: jwtExpiresIn(
      pick(config, 'ACCESS_TOKEN_EXPIRES_IN'),
      'ACCESS_TOKEN_EXPIRES_IN',
    ),
    REFRESH_TOKEN_EXPIRES_IN: jwtExpiresIn(
      pick(config, 'REFRESH_TOKEN_EXPIRES_IN'),
      'REFRESH_TOKEN_EXPIRES_IN',
    ),
    MAX_ACTIVE_SESSIONS_PER_USER: positiveIntWithDefault(
      pick(config, 'MAX_ACTIVE_SESSIONS_PER_USER'),
      'MAX_ACTIVE_SESSIONS_PER_USER',
      20,
    ),
  };
}
