import dotenv from 'dotenv';
dotenv.config();

/**
 * Validates environment variables.
 * In production mode (or STRICT_ENV=true), strictly prevents empty, localhost, or dev-default secrets.
 * In development or test mode, allows safe local defaults.
 */
export function validateEnv(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const isStrict = isProduction || env.STRICT_ENV === 'true';

  const errors = [];
  const rawDbUrl = env.DATABASE_URL;
  const rawRedisUrl = env.REDIS_URL;
  const rawJwtSecret = env.JWT_SECRET;
  const allowLocalhost = env.ALLOW_LOCALHOST_IN_PROD === 'true';

  if (isStrict) {
    if (!rawDbUrl || rawDbUrl.trim() === '') {
      errors.push('DATABASE_URL is required in production mode. Set a valid PostgreSQL connection string.');
    } else if (!allowLocalhost && (rawDbUrl.includes('localhost') || rawDbUrl.includes('127.0.0.1'))) {
      errors.push('DATABASE_URL points to localhost/127.0.0.1 in production. Provide a valid external PostgreSQL connection string (or set ALLOW_LOCALHOST_IN_PROD=true if intentional).');
    }

    if (!rawRedisUrl || rawRedisUrl.trim() === '') {
      errors.push('REDIS_URL is required in production mode. Set a valid Redis connection string.');
    } else if (!allowLocalhost && (rawRedisUrl.includes('localhost') || rawRedisUrl.includes('127.0.0.1'))) {
      errors.push('REDIS_URL points to localhost/127.0.0.1 in production. Provide a valid external Redis connection string (or set ALLOW_LOCALHOST_IN_PROD=true if intentional).');
    }

    if (!rawJwtSecret || rawJwtSecret.trim() === '') {
      errors.push('JWT_SECRET is required in production mode.');
    } else if (rawJwtSecret === 'roomsync-super-secret-dev-jwt-key-32chars') {
      errors.push('JWT_SECRET cannot use the default insecure development secret in production.');
    } else if (rawJwtSecret.length < 32) {
      errors.push(`JWT_SECRET must be at least 32 characters for security. Received ${rawJwtSecret.length} characters.`);
    }
  }

  if (errors.length > 0) {
    const message = `[FATAL CONFIG ERROR] Production configuration check failed:\n  - ${errors.join('\n  - ')}`;
    console.error(message);
    const err = new Error(message);
    err.configErrors = errors;
    throw err;
  }

  return true;
}

// Run validation for current runtime environment
validateEnv();

export const config = {
  port: parseInt(process.env.API_PORT || process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'roomsync-super-secret-dev-jwt-key-32chars',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/roomsync',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  corsOrigin: process.env.CORS_ORIGIN || '*'
};
