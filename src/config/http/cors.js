const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://hoteloms.netlify.app',
  'https://hotel-order-management-system.onrender.com'
];

const buildCorsOrigins = () => {
  const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return allowedOrigins.length > 0 ? allowedOrigins : defaultOrigins;
};

const buildCorsOptions = () => {
  const origins = buildCorsOrigins();
  return {
    origin: (origin, callback) => {
      if (!origin || origins.includes(origin)) {
        return callback(null, true);
      }
      if (process.env.NODE_ENV === 'production') {
        return callback(new Error('Not allowed by CORS'));
      }
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-branch-id'],
    credentials: true
  };
};

module.exports = {
  buildCorsOptions,
  buildCorsOrigins
};
