export interface AppEnv {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  MONGODB_URI: string;
  ACCESS_TOKEN_SECRET: string;
  REFRESH_TOKEN_SECRET: string;
}

function requireString(value: unknown, key: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Environment variable ${key} is required`);
  }

  return value.trim();
}

function parsePort(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return 3000;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('Environment variable PORT must be a valid port number');
  }

  return port;
}

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const nodeEnv = config.NODE_ENV;
  if (
    nodeEnv !== 'development' &&
    nodeEnv !== 'test' &&
    nodeEnv !== 'production' &&
    nodeEnv !== undefined
  ) {
    throw new Error(
      'Environment variable NODE_ENV must be development, test, or production',
    );
  }

  return {
    NODE_ENV: (nodeEnv ?? 'development') as AppEnv['NODE_ENV'],
    PORT: parsePort(config.PORT),
    MONGODB_URI: requireString(config.MONGODB_URI, 'MONGODB_URI'),
    ACCESS_TOKEN_SECRET: requireString(
      config.ACCESS_TOKEN_SECRET,
      'ACCESS_TOKEN_SECRET',
    ),
    REFRESH_TOKEN_SECRET: requireString(
      config.REFRESH_TOKEN_SECRET,
      'REFRESH_TOKEN_SECRET',
    ),
  };
}
