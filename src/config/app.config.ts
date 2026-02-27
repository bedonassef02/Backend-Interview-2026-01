import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // API / Network
  PORT: Joi.number().default(3000),
  CORS_ORIGIN: Joi.string().default('*'),

  // Authentication
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRATION: Joi.string().default('1h'),
  API_KEY: Joi.string().min(8).required(),

  // Admin Credentials (for UI login)
  ADMIN_USERNAME: Joi.string().default('admin'),
  ADMIN_PASSWORD: Joi.string().min(6).required(),

  // Rate Limiting (Global defaults)
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(10),
});
