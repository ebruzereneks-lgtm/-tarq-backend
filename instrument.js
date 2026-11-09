const Sentry = require("@sentry/node");

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development"
  });

  console.log("Sentry monitoring enabled");
} else {
  console.log("Sentry monitoring disabled: SENTRY_DSN not configured");
}

module.exports = Sentry;
