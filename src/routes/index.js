// src/routes/index.js
const express = require("express");
const router = express.Router();

// Import route modules
const authRoutes = require("./authRoutes");
const messRoutes = require("./messRoutes");
const studentRoutes = require("./studentRoutes");
const paymentRoutes = require("./paymentRoutes");
const ownerRoutes = require("./ownerRoutes");
const notificationRoutes = require("./notificationRoutes");

// Register routes with prefixes
router.use("/auth", authRoutes);
router.use("/mess", messRoutes);
router.use("/students", studentRoutes);
router.use("/payments", paymentRoutes);
router.use("/owners", ownerRoutes);
router.use("/notifications", notificationRoutes);

router.get("/", (req, res) => {
  res.json({
    message: "TrackMyMess API is running 🚀",
    routes: {
      auth: "/api/auth",
      mess: "/api/mess",
      students: "/api/students",
      payments: "/api/payments",
      owners: "/api/owners",
      notifications: "/api/notifications",
    },
  });
});

module.exports = router;
