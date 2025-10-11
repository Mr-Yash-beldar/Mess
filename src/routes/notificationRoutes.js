const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const { getNotifications } = require("../controllers/notificationController");

// Protected route - admin and owner can access
router.use(protect);
router.get("/", authorizeRoles("admin"), getNotifications);

module.exports = router;
