const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const {
  listOwners,
  getOwner,
  createOwner,
  updateOwner,
  toggleActive,
} = require("../controllers/ownerController");

// All routes admin-only
router.use(protect, authorizeRoles("admin"));

router.get("/", listOwners);
router.get("/:id", getOwner);
router.post("/", createOwner);
router.put("/:id", updateOwner);
router.post("/:id/toggle-active", toggleActive); // toggle and optionally extend subscription

module.exports = router;
