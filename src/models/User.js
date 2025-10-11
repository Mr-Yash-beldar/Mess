// src/models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["admin", "owner"],
      required: true,
    },
    // If the user is a mess owner, link to mess
    messId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mess",
      default: null,
    },
  },
  { timestamps: true }
);

// Additional owner-specific fields
userSchema.add({
  name: { type: String, default: "" },
  contact: { type: String, default: "" },
  email: { type: String, default: "" },
  isActive: { type: Boolean, default: true },
  subscriptionExpiry: { type: Date, default: null },
});

// 🔒 Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// 🧩 Method to compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
