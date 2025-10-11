// src/models/Mess.js
const mongoose = require("mongoose");

const messSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    capacity: {
      type: Number,
      required: true,
    },
    address: {
      type: String,
      default: "",
    },
    totalStudents: {
      type: Number,
      default: 0,
    },
    revenue: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Mess = mongoose.model("Mess", messSchema);
module.exports = Mess;
