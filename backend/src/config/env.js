require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

// Dev-only fallbacks; production must supply real secrets.
function secret(name, devFallback) {
  return required(name, isProduction ? undefined : devFallback);
}

module.exports = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv,
  jwtSecret: secret('JWT_SECRET', 'dev-secret-change-me'),
  jwtRefreshSecret: secret('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  jitsiDomain: process.env.JITSI_DOMAIN || 'meet.jit.si',
};
