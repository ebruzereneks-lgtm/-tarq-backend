const express = require("express");
const authRoutes = require("./routes/auth");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("TARQ Backend Running");
});

app.use("/api/auth", authRoutes);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
