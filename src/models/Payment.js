// src/models/Payment.js
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    messId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mess",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    month: {
      type: String, // format: YYYY-MM
      default: null,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    paymentMode: {
      type: String,
      enum: ["Cash", "UPI", "Bank Transfer", "Card"],
      default: "Cash",
    },
    note: {
      type: String,
      default: "",
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const Payment = mongoose.model("Payment", paymentSchema);
module.exports = Payment;
