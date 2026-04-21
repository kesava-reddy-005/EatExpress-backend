const jwt = require("jsonwebtoken");
require("dotenv").config();

/* ---------- VERIFY JWT TOKEN ---------- */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

/* ---------- ROLE-BASED ACCESS ---------- */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden. Insufficient permissions." });
    }
    next();
  };
};

/* ---------- GENERATE TOKEN ---------- */
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
  });
};

module.exports = { verifyToken, requireRole, generateToken };
