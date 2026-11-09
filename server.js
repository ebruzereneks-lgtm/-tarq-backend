require("./instrument");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const pinoHttp = require("pino-http");
const pool = require("./db");
const logger = require("./logger");

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const storeRoutes = require("./routes/stores");
const favoriteRoutes = require("./routes/favorites");
const priceRoutes = require("./routes/prices");
const priceAlertRoutes = require("./routes/priceAlerts");
const priceHistoryRoutes = require("./routes/priceHistory");
const notificationRoutes = require("./routes/notifications");
const aiRoutes = require("./routes/ai");
const userProfileRoutes = require("./routes/userProfiles");
const personalizedDecisionRoutes = require("./routes/personalizedDecision");
const dataSourceRoutes = require("./routes/dataSources");

const app = express();
const PORT = process.env.PORT || 3000;

// Structured HTTP request and response logging.
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore(req) {
        return req.url === "/health";
      }
    }
  })
);

// Security headers
app.use(helmet());

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "http://localhost:8080"
];

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
      ) {
        return callback(null, true);
      }

      const error = new Error("CORS origin not allowed");
      error.status = 403;
      return callback(error);
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS"
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ]
  })
);

// Limit JSON request bodies to reduce oversized-request risk.
app.use(
  express.json({
    limit: "100kb"
  })
);

app.get("/", (req, res) => {
  res.send("TARQ Backend Running");
});

// Liveness monitoring: Node/Express process is responding.
app.get("/health", (req, res) => {
  return res.status(200).json({
    status: "healthy",
    service: "tarq-backend",
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Readiness monitoring: Backend and PostgreSQL are available.
app.get("/ready", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    return res.status(200).json({
      status: "ready",
      database: "connected",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Readiness check failed:", error);

    return res.status(503).json({
      status: "not_ready",
      database: "unavailable"
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/prices", priceRoutes);

app.use(
  "/api/price-alerts",
  priceAlertRoutes
);

app.use(
  "/api/price-history",
  priceHistoryRoutes
);

app.use(
  "/api/notifications",
  notificationRoutes
);

// TARQ AI - Stage 8.1
app.use(
  "/api/ai",
  aiRoutes
);

// TARQ Personalization - Stage 8.3
app.use(
  "/api/user-profiles",
  userProfileRoutes
);

// TARQ Personalized Decision + Explainable AI
app.use(
  "/api/personalized-decision",
  personalizedDecisionRoutes
);

// TARQ Authorized Data Sources - Stage 8.5
app.use(
  "/api/data-sources",
  dataSourceRoutes
);

// Controlled 404 response for unknown API/routes.
app.use((req, res) => {
  return res.status(404).json({
    message: "API endpoint not found"
  });
});

// Controlled error responses.
// Prevent internal error details from being exposed to clients.
app.use((err, req, res, next) => {
  if (err && err.message === "CORS origin not allowed") {
    return res.status(403).json({
      message: "CORS origin not allowed"
    });
  }

  console.error(err);

  return res.status(err.status || 500).json({
    message: "Internal server error"
  });
});

app.listen(PORT, () => {
  console.log(
    `Server listening on port ${PORT}`
  );
});


