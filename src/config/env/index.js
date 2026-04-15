const getEnv = (key, fallback = undefined) => {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
};

const env = {
  nodeEnv: getEnv('NODE_ENV', 'development'),
  port: getEnv('PORT'),
  mongoUri: getEnv('MONGO_URI'),
  jwtSecret: getEnv('JWT_SECRET')
};

const validateRequiredEnv = () => {
  const missing = [];
  if (!env.port) missing.push('PORT');
  if (!env.mongoUri) missing.push('MONGO_URI');
  if (!env.jwtSecret) missing.push('JWT_SECRET');
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
};

module.exports = {
  env,
  getEnv,
  validateRequiredEnv
};
