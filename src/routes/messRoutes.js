// src/routes/messRoutes.js
const express = require("express");
const router = express.Router();

const {
  getAllMesses,
  getMessById,
  createMess,
  updateMess,
  deleteMess,
  assignOwner,
} = require("../controllers/messController");

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

// 🧭 Routes
router.get("/", protect, authorizeRoles("admin"), getAllMesses);
router.get(
  "/unassigned",
  protect,
  authorizeRoles("admin"),
  require("../controllers/messController").getUnassignedMesses
);
router.get("/:id", protect, authorizeRoles("admin", "owner"), getMessById);
router.post("/", protect, authorizeRoles("admin"), createMess);
router.put("/:id", protect, authorizeRoles("admin"), updateMess);
router.post("/:id/assign-owner", protect, authorizeRoles("admin"), assignOwner);
router.delete("/:id", protect, authorizeRoles("admin"), deleteMess);

module.exports = router;
