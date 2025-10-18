// src/controllers/studentController.js
const Student = require("../models/Student");
const Mess = require("../models/Mess");
const Payment = require("../models/Payment");

// @desc    Get all students for a mess
// @route   GET /api/students
// @access  Admin / Owner
exports.getStudents = async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === "owner") {
      filter.messId = req.user.messId;
    } else if (req.query.messId) {
      filter.messId = req.query.messId;
    }

    const Payment = require("../models/Payment");
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

    const students = await Student.find(filter).sort({ createdAt: -1 });

    // Get all payments for current month
    const payments = await Payment.find({
      studentId: { $in: students.map((s) => s._id) },
      month: currentMonth,
    });

    // Create a map of student payments
    const paymentMap = new Map(
      payments.map((p) => [p.studentId.toString(), p])
    );

    const formatted = students.map((s) => ({
      id: s._id,
      name: s.name,
      gender: s.gender,
      mobile: s.mobile,
      address: s.address,
      joiningDate: new Date(s.createdAt).toLocaleDateString("en-GB"),
      messId: s.messId,
      mealPlan: s.mealPlan,
      monthlyFee: s.fee,
      membershipExpiry: s.membershipEnd
        ? new Date(s.membershipEnd).toLocaleDateString("en-GB")
        : null,
      paymentStatus: paymentMap.has(s._id.toString()) ? "paid" : "unpaid",
      isFrozen: s.isFrozen || false,
      frozenDate: s.freezeStart
        ? new Date(s.freezeStart).toLocaleDateString("en-GB")
        : null,
    }));

    res.json(formatted);
  } catch (error) {
    // console.error("Error fetching students:", error);
    res.status(500).json({ error: "Failed to fetch students" });
  }
};

// @desc    Get single student by ID
// @route   GET /api/students/:id
// @access  Admin / Owner
exports.getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });

    // Restrict owners to their own mess
    if (
      req.user.role === "owner" &&
      student.messId.toString() !== req.user.messId.toString()
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    const Payment = require("../models/Payment");
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

    // Check current month's payment
    const payment = await Payment.findOne({
      studentId: student._id,
      month: currentMonth,
    });

    const formatted = {
      id: student._id,
      name: student.name,
      gender: student.gender,
      mobile: student.mobile,
      address: student.address,
      joiningDate: new Date(student.startDate).toLocaleDateString("en-GB"),
      messId: student.messId,
      mealPlan: student.mealPlan,
      monthlyFee: student.fee,
      membershipExpiry: student.membershipEnd
        ? new Date(student.membershipEnd).toLocaleDateString("en-GB")
        : null,
      paymentStatus: payment ? "paid" : "unpaid",
      isFrozen: student.isFrozen || false,
      frozenDate: student.freezeStart
        ? new Date(student.freezeStart).toLocaleDateString("en-GB")
        : null,
    };

    res.json(formatted);
  } catch (error) {
    // console.error("Error fetching student:", error);
    res.status(500).json({ error: "Failed to fetch student" });
  }
};

// @desc    Add new student
// @route   POST /api/students
// @access  Admin / Owner
exports.addStudent = async (req, res) => {
  try {
    const { name, mobile, address, mealPlan, fee, messId, gender } = req.body;

    const assignedMessId = req.user.role === "owner" ? req.user.messId : messId;
    if (!assignedMessId)
      return res.status(400).json({ error: "Mess ID is required" });

    const mess = await Mess.findById(assignedMessId);
    if (!mess) return res.status(404).json({ error: "Mess not found" });

    // Check capacity
    const count = await Student.countDocuments({ messId: assignedMessId });
    if (count >= mess.capacity) {
      return res.status(400).json({ error: "Mess is full. Capacity reached." });
    }

    const student = await Student.create({
      messId: assignedMessId,
      name,
      mobile,
      address,
      mealPlan,
      fee,
      gender,
    });

    // Update total student count
    mess.totalStudents = count + 1;
    await mess.save();

    res.status(201).json({ message: "Student added successfully", student });
  } catch (error) {
    // console.error("Error adding student:", error);
    res.status(500).json({ error: "Failed to add student", err: error });
  }
};

// @desc    Update student details
// @route   PUT /api/students/:id
// @access  Admin / Owner
exports.updateStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });

    if (
      req.user.role === "owner" &&
      student.messId.toString() !== req.user.messId.toString()
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    // normalize update fields: prevent accidental endDate usage
    const updatePayload = { ...req.body };
    if (updatePayload.endDate) {
      updatePayload.membershipEnd = updatePayload.endDate;
      delete updatePayload.endDate;
    }

    const updated = await Student.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      {
        new: true,
      }
    );
    res.json({ message: "Student updated successfully", student: updated });
  } catch (error) {
    // console.error("Error updating student:", error);
    res.status(500).json({ error: "Failed to update student" });
  }
};

// @desc    Delete student
// @route   DELETE /api/students/:id
// @access  Admin / Owner
exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });

    if (
      req.user.role === "owner" &&
      student.messId.toString() !== req.user.messId.toString()
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Delete payments associated with this student and adjust mess revenue
    try {
      const payments = await Payment.find({ studentId: student._id });
      if (payments && payments.length > 0) {
        const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        if (student.messId && totalPaid !== 0) {
          await Mess.findByIdAndUpdate(student.messId, {
            $inc: { revenue: -totalPaid },
          });
        }
        await Payment.deleteMany({ studentId: student._id });
      }
    } catch (e) {
      // console.error("Failed to cleanup payments for student:", e);
      // continue with deletion of student even if cleanup fails
    }

    await student.deleteOne();

    // Update mess total student count
    if (student.messId) {
      await Mess.findByIdAndUpdate(student.messId, {
        $inc: { totalStudents: -1 },
      });
    }

    res.json({ message: "Student deleted successfully" });
  } catch (error) {
    // console.error("Error deleting student:", error);
    res.status(500).json({ error: "Failed to delete student" });
  }
};

// @desc    Freeze or Unfreeze student
// @route   PUT /api/students/:id/freeze
// @access  Admin / Owner
exports.toggleFreeze = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });

    if (
      req.user.role === "owner" &&
      student.messId.toString() !== req.user.messId.toString()
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    student.isFrozen = !student.isFrozen;
    if (student.isFrozen) {
      student.freezeStart = new Date();
      student.freezeEnd = null;
    } else {
      student.freezeEnd = new Date();
    }
    await student.save();

    res.json({
      message: `Student ${
        student.isFrozen ? "frozen" : "unfrozen"
      } successfully`,
      student,
    });
  } catch (error) {
    // console.error("Error freezing student:", error);
    res.status(500).json({ error: "Failed to toggle freeze" });
  }
};
