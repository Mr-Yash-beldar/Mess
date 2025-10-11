// src/controllers/authController.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      username: user.username,
      role: user.role,
      messId: user.messId,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

// @desc    User login (Admin or Owner)
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json({ error: "Username and password required" });

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const token = generateToken(user);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        messId: user.messId,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Server error during login" });
  }
};

// @desc    Get current user from token
// @route   GET /api/auth/me
// @access  Protected (token in Authorization header)
exports.me = async (req, res) => {
  try {
    // protect middleware already attaches req.user with password excluded
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    // Fetch fresh user from DB to include populated mess and originalPassword
    const userFull = await User.findById(req.user.id).populate(
      "messId",
      "name"
    );
    if (!userFull) return res.status(404).json({ error: "User not found" });

    const out = {
      id: userFull._id,
      username: userFull.username,
      name: userFull.name || "",
      contact: userFull.contact || "",
      email: userFull.email || "",
      messId: userFull.messId ? userFull.messId._id : null,
      messName: userFull.messId ? userFull.messId.name : null,
      password: userFull.originalPassword || null,
      isActive: userFull.isActive,
      subscriptionExpiry: userFull.subscriptionExpiry
        ? new Date(userFull.subscriptionExpiry).toISOString().split("T")[0]
        : null,
    };
    res.json({ user: out });
  } catch (err) {
    console.error("Error in /api/auth/me:", err);
    res.status(500).json({ error: "Server error" });
  }
};
