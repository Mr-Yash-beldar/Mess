// src/routes/authRoutes.js
const express = require("express");
const router = express.Router();

const { login, me } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

// 🧭 Routes
// @route   POST /api/auth/login
// @desc    User login (Admin or Mess Owner)
// @access  Public
router.post("/login", login);
router.get("/me", protect, me);

module.exports = router;
