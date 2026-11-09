const pino = require("pino");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",

  base: {
    service: "tarq-backend",
    environment: process.env.NODE_ENV || "development"
  },

  redact: {
    paths: [
      "password",
      "token",
      "access_token",
      "refresh_token",
      "authorization",
      "headers.authorization",
      "req.headers.authorization",
      "body.password",
      "body.token",
      "JWT_SECRET",
      "SENTRY_DSN"
    ],
    censor: "[REDACTED]"
  }
});

module.exports = logger;
