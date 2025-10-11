// src/controllers/paymentController.js
const Payment = require("../models/Payment");
const Student = require("../models/Student");
const Mess = require("../models/Mess");

// @desc    Get all payments (filtered by mess if owner)
// @route   GET /api/payments
// @access  Admin / Owner
exports.getPayments = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "owner") {
      filter.messId = req.user.messId;
    } else if (req.query.messId) {
      filter.messId = req.query.messId;
    }

    if (req.query.studentId) {
      filter.studentId = req.query.studentId;
    }

    const payments = await Payment.find(filter)
      .populate("studentId", "name mobile fee")
      .populate("messId", "name")
      .populate("recordedBy", "username role")
      .sort({ paymentDate: -1 });

    const formatted = payments.map((p) => {
      // Convert month (YYYY-MM) to Month YYYY format
      const [year, month] = p.month.split("-");
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const monthName = monthNames[parseInt(month) - 1];

      // Determine payment status from the student's paymentStatus map keyed by YYYY-MM
      let status = "Pending";
      const monthlyFee = p.studentId.fee;
      if (p.amount === monthlyFee) {
        status = "paid";
      } else if (p.amount < monthlyFee) {
        status = "partial";
      } else if (p.amount > monthlyFee) {
        status = "error";
      }
      // If membership expired before the payment date and not paid, mark as overdue
      if (
        p.studentId &&
        p.studentId.membershipEnd &&
        new Date(p.studentId.membershipEnd) < new Date() &&
        status !== "paid"
      ) {
        status = "overdue";
      }

      return {
        id: p._id,
        studentId: p.studentId._id,
        studentName: p.studentId.name,
        messId: p.messId._id,
        messName: p.messId.name,
        amount: p.amount,
        date: p.paymentDate.toISOString().split("T")[0],
        mode: p.paymentMode,
        status,
        month: `${monthName} ${year}`,
        monthlyFee: p.studentId.fee,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
};

// @desc    Get payment by ID
// @route   GET /api/payments/:id
// @access  Admin / Owner
exports.getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate("studentId", "name fee")
      .populate("messId", "name")
      .populate("recordedBy", "username role");

    if (!payment) return res.status(404).json({ error: "Payment not found" });

    if (
      req.user.role === "owner" &&
      payment.messId.toString() !== req.user.messId.toString()
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Convert month (YYYY-MM) to Month YYYY format
    const [year, month] = payment.month.split("-");
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const monthName = monthNames[parseInt(month) - 1];

    const formatted = {
      id: payment._id,
      studentId: payment.studentId._id,
      studentName: payment.studentId.name,
      messId: payment.messId._id,
      messName: payment.messId.name,
      amount: payment.amount,
      date: payment.paymentDate.toISOString().split("T")[0],
      mode: payment.paymentMode,
      // Determine status from student's paymentStatus for the payment month
      status: (() => {
        let st = "unpaid";
        if (payment.studentId && payment.studentId.paymentStatus) {
          const map =
            payment.studentId.paymentStatus instanceof Map
              ? payment.studentId.paymentStatus
              : new Map(Object.entries(payment.studentId.paymentStatus || {}));
          const v = map.get(payment.month);
          if (v) st = v;
        }
        if (
          payment.studentId &&
          payment.studentId.membershipEnd &&
          new Date(payment.studentId.membershipEnd) < new Date() &&
          st !== "paid"
        ) {
          st = "overdue";
        }
        return st;
      })(),
      month: `${monthName} ${year}`,
      monthlyFee: payment.studentId.fee,
    };

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching payment:", error);
    res.status(500).json({ error: "Failed to fetch payment" });
  }
};

// @desc    Record new payment
// @route   POST /api/payments
// @access  Admin / Owner
exports.addPayment = async (req, res) => {
  try {
    const { studentId, amount, paymentMode } = req.body;

    if (!studentId || !amount) {
      return res
        .status(400)
        .json({ error: "Student ID and amount are required" });
    }

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });

    if (
      req.user.role === "owner" &&
      student.messId.toString() !== req.user.messId.toString()
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    console.log("Recording payment:", {
      studentId,
      amount,
      paymentMode,
      recordedBy: req.user._id,
    });
    // determine payment month (YYYY-MM)
    const payMonth = new Date().toISOString().slice(0, 7);

    const payment = await Payment.create({
      messId: student.messId,
      studentId: student._id,
      amount,
      month: payMonth,
      paymentMode,
      recordedBy: req.user._id,
    });

    // Update mess revenue
    await Mess.findByIdAndUpdate(student.messId, { $inc: { revenue: amount } });

    // If payment is for current month, extend membershipEnd by 30 days
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (payMonth === currentMonth) {
      // extend student's membershipEnd by 30 days
      const base =
        student.membershipEnd && student.membershipEnd > new Date()
          ? new Date(student.membershipEnd)
          : new Date();
      base.setDate(base.getDate() + 30);
      student.membershipEnd = base;
      await student.save();
    }
    // mark payment status for month as 'paid'
    try {
      // Ensure paymentStatus is a Map (Mongoose Map) -- if it's an object (from older docs), convert it
      if (!student.paymentStatus) {
        student.paymentStatus = new Map();
      } else if (!(student.paymentStatus instanceof Map)) {
        // convert plain object to Map
        student.paymentStatus = new Map(
          Object.entries(student.paymentStatus || {})
        );
      }

      student.paymentStatus.set(payMonth, "paid");
      await student.save();
    } catch (e) {
      console.error("Failed to update student paymentStatus:", e);
    }

    res.status(201).json({ message: "Payment recorded successfully", payment });
  } catch (error) {
    console.error("Error adding payment:", error);
    res.status(500).json({ error: "Failed to add payment" });
  }
};

// @desc    Delete a payment
// @route   DELETE /api/payments/:id
// @access  Admin / Owner
exports.deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    if (
      req.user.role === "owner" &&
      payment.messId.toString() !== req.user.messId.toString()
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    await Mess.findByIdAndUpdate(payment.messId, {
      $inc: { revenue: -payment.amount },
    });
    await payment.deleteOne();

    res.json({ message: "Payment deleted successfully" });
  } catch (error) {
    console.error("Error deleting payment:", error);
    res.status(500).json({ error: "Failed to delete payment" });
  }
};
