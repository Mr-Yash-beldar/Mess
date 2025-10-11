// src/models/Student.js
const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    messId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mess",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    mealPlan: {
      type: String,
      enum: ["Full", "Half", "Custom"],
      default: "Full",
    },
    fee: {
      type: Number,
      required: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    membershipEnd: {
      type: Date,
      required: false,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      default: "Male",
    },
    // map of month (YYYY-MM) -> 'paid' | 'pending'
    paymentStatus: {
      type: Map,
      of: String,
      default: {},
    },
    isFrozen: {
      type: Boolean,
      default: false,
    },
    freezeStart: {
      type: Date,
      default: null,
    },
    freezeEnd: {
      type: Date,
      default: null,
    },
    remarks: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// include virtuals in JSON/object output
studentSchema.set("toJSON", { virtuals: true });
studentSchema.set("toObject", { virtuals: true });

// virtual to indicate overdue (membershipEnd passed)
studentSchema.virtual("isOverdue").get(function () {
  if (!this.membershipEnd) return false;
  return new Date(this.membershipEnd) < new Date();
});

// Ensure membershipEnd defaults to startDate + 30 days when not set
studentSchema.pre("save", function (next) {
  if (!this.membershipEnd) {
    const base = this.startDate ? new Date(this.startDate) : new Date();
    base.setDate(base.getDate() + 30);
    this.membershipEnd = base;
  }
  next();
});

const Student = mongoose.model("Student", studentSchema);
module.exports = Student;
