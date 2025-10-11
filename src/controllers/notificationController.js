const Mess = require("../models/Mess");
const Student = require("../models/Student");
const Payment = require("../models/Payment");

// GET /api/notifications
// Returns aggregated notifications: capacity alerts, overdue payments, memberships expiring
exports.getNotifications = async (req, res) => {
  try {
    const isOwner = req.user && req.user.role === "owner";
    const ownerMessId = isOwner ? req.user.messId : null;

    // 1) Capacity alerts: messes with occupancy >= 85%
    const messFilter = ownerMessId ? { _id: ownerMessId } : {};
    const messes = await Mess.find(messFilter).lean();

    const capacityAlerts = [];
    for (const m of messes) {
      const total = m.capacity || 0;
      const occupied = m.totalStudents || 0;
      const percent = total > 0 ? Math.round((occupied / total) * 100) : 0;
      if (percent >= 85) {
        capacityAlerts.push({
          type: "capacity",
          message: `${m.name} is at ${percent}% capacity (${occupied}/${total} students)`,
          date: new Date().toISOString().split("T")[0],
          read: false,
          messId: m._id,
        });
      }
    }

    // 2) Overdue payments: count students with membershipEnd passed and not paid for current month
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const studentFilter = ownerMessId ? { messId: ownerMessId } : {};
    const students = await Student.find(studentFilter).lean();

    let overdueCount = 0;
    for (const s of students) {
      // check membership end
      if (s.membershipEnd && new Date(s.membershipEnd) < new Date()) {
        // check paymentStatus map for current month
        let status = "unpaid";
        if (s.paymentStatus) {
          const map =
            s.paymentStatus instanceof Map ? s.paymentStatus : s.paymentStatus;
          // when lean() is used, paymentStatus will be plain object
          const v = map ? map[currentMonth] || map.get?.(currentMonth) : null;
          if (v) status = v;
        }
        if (status !== "paid") overdueCount += 1;
      }
    }

    const paymentAlerts = [];
    if (overdueCount > 0) {
      paymentAlerts.push({
        type: "payment",
        message: `${overdueCount} overdue payments pending${
          isOwner ? "" : " across all messes"
        }`,
        date: new Date().toISOString().split("T")[0],
        read: false,
      });
    }

    // 3) Memberships expiring this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    const expFilter = Object.assign({}, studentFilter, {
      membershipEnd: { $gte: startOfMonth, $lt: endOfMonth },
    });
    const expiringCount = await Student.countDocuments(expFilter);

    const membershipAlerts = [];
    if (expiringCount > 0) {
      membershipAlerts.push({
        type: "membership",
        message: `${expiringCount} memberships expiring this month`,
        date: new Date().toISOString().split("T")[0],
        read: false,
      });
    }

    const notifications = [
      ...capacityAlerts,
      ...paymentAlerts,
      ...membershipAlerts,
    ];
    console.log("Notifications:", notifications);
    res.json({ notifications });
  } catch (err) {
    console.error("Error getting notifications:", err);
    res.status(500).json({ error: "Failed to get notifications" });
  }
};
