const express = require("express");

const authRoutes = require("./routes/auth");
const favoriteRoutes = require("./routes/favorites");
const priceRoutes = require("./routes/prices");
const priceAlertRoutes = require("./routes/priceAlerts");
const priceHistoryRoutes = require("./routes/priceHistory");
const notificationRoutes = require("./routes/notifications");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("TARQ Backend Running");
});

app.use("/api/auth", authRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/prices", priceRoutes);
app.use("/api/price-alerts", priceAlertRoutes);
app.use("/api/price-history", priceHistoryRoutes);
app.use("/api/notifications", notificationRoutes);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});