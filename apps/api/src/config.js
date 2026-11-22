import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.API_PORT || process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'roomsync-super-secret-dev-jwt-key-32chars',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/roomsync',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  corsOrigin: process.env.CORS_ORIGIN || '*'
};
