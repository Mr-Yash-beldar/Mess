// src/routes/paymentRoutes.js
const express = require("express");
const router = express.Router();

const {
  getPayments,
  getPaymentById,
  addPayment,
  deletePayment,
} = require("../controllers/paymentController");

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

// 🧭 Routes
router.get("/", protect, authorizeRoles("admin", "owner"), getPayments);
router.get("/:id", protect, authorizeRoles("admin", "owner"), getPaymentById);
router.post("/", protect, authorizeRoles("admin", "owner"), addPayment);
router.delete("/:id", protect, authorizeRoles("admin", "owner"), deletePayment);

module.exports = router;
