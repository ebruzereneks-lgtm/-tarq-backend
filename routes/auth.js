const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const { findByEmail, createUser } = require("../store/users");
const { signToken, requireAuth } = require("../middleware/auth");

const router = express.Router();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function validateCredentials(email, password) {
  if (!email || !password) {
    return "Email and password are required";
  }

  if (!EMAIL_REGEX.test(email)) {
    return "Please provide a valid email address";
  }

  if (typeof password !== "string" || password.length < 6) {
    return "Password must be at least 6 characters";
  }

  return null;
}

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  const error = validateCredentials(email, password);

  if (error) {
    return res.status(400).json({ message: error });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  if (await findByEmail(normalizedEmail)) {
    return res.status(409).json({
      message: "An account with this email already exists"
    });
}

  const hashedPassword = await bcrypt.hash(password, 10);
const user = await createUser({
    id: crypto.randomUUID(),
    name: typeof name === "string" && name.trim() ? name.trim() : null,
    email: normalizedEmail,
    password: hashedPassword,
    createdAt: new Date().toISOString(),
  });

  return res.status(201).json({
    message: "Registration successful",
    user: publicUser(user),
    token: signToken(user),
  });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const error = validateCredentials(email, password);

  if (error) {
    return res.status(400).json({ message: error });
  }

const user = await findByEmail(String(email).trim().toLowerCase());
  const passwordMatches = user ? await bcrypt.compare(password, user.password) : false;

  if (!user || !passwordMatches) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  return res.json({
    message: "Login successful",
    user: publicUser(user),
    token: signToken(user),
  });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await findByEmail(req.user.email);

  if (!user) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  return res.json({ user: publicUser(user) });
});

module.exports = router;
