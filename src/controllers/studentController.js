// src/controllers/studentController.js
const Student = require("../models/Student");
const Mess = require("../models/Mess");

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

    const students = await Student.find(filter).sort({ createdAt: -1 });
    res.json(students);
  } catch (error) {
    console.error("Error fetching students:", error);
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

    res.json(student);
  } catch (error) {
    console.error("Error fetching student:", error);
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
    console.error("Error adding student:", error);
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
    console.error("Error updating student:", error);
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

    await student.deleteOne();

    // Update mess total student count
    await Mess.findByIdAndUpdate(student.messId, {
      $inc: { totalStudents: -1 },
    });

    res.json({ message: "Student deleted successfully" });
  } catch (error) {
    console.error("Error deleting student:", error);
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
    console.error("Error freezing student:", error);
    res.status(500).json({ error: "Failed to toggle freeze" });
  }
};
