// src/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Middleware to verify JWT token
exports.protect = async (req, res, next) => {
  let token;

  // Expecting token in Authorization header: "Bearer <token>"
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ error: "Not authorized, token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password"); // attach user to request
    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ error: "Not authorized, invalid token" });
  }
};
