// src/routes/studentRoutes.js
const express = require("express");
const router = express.Router();

const {
  getStudents,
  getStudentById,
  addStudent,
  updateStudent,
  deleteStudent,
  toggleFreeze,
} = require("../controllers/studentController");

const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

// 🧭 Routes
router.get("/", protect, authorizeRoles("admin", "owner"), getStudents);
router.get("/:id", protect, authorizeRoles("admin", "owner"), getStudentById);
router.post("/", protect, authorizeRoles("admin", "owner"), addStudent);
router.put("/:id", protect, authorizeRoles("admin", "owner"), updateStudent);
router.delete("/:id", protect, authorizeRoles("admin", "owner"), deleteStudent);

// Freeze / Unfreeze student
router.put(
  "/:id/freeze",
  protect,
  authorizeRoles("admin", "owner"),
  toggleFreeze
);

module.exports = router;
