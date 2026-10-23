const jwt = require("jsonwebtoken");

const JWT_SECRET =
  process.env.JWT_SECRET || "tarq-dev-secret-change-me";

// Login sırasında JWT oluşturur
function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email
    },
    JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}

// Korumalı API isteklerinde JWT kontrol eder
function requireAuth(req, res, next) {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader) {
    return res.status(401).json({
      message: "Authorization token required"
    });
  }

  const parts = authorizationHeader.split(" ");

  if (
    parts.length !== 2 ||
    parts[0] !== "Bearer" ||
    !parts[1]
  ) {
    return res.status(401).json({
      message: "Invalid authorization format"
    });
  }

  try {
    const decoded = jwt.verify(parts[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token"
    });
  }
}

// Eski ve yeni TARQ dosyalarıyla uyumluluk
module.exports = requireAuth;
module.exports.signToken = signToken;
module.exports.requireAuth = requireAuth;
module.exports.auth = requireAuth;
module.exports.authenticateToken = requireAuth;