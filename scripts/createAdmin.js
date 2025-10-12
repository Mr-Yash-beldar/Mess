#!/usr/bin/env node
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("../src/config/db");

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/trackmymess";

async function main() {
  try {
    await connectDB(MONGO_URI);

    const username = "admin";
    const plain = "admin123";
    const role = "admin";

    // Check existing
    const existing = await mongoose.connection
      .collection("users")
      .findOne({ username });
    if (existing) {
      console.log(`User '${username}' already exists with id=${existing._id}`);
      await mongoose.disconnect();
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(plain, salt);

    // Insert document without originalPassword field
    const doc = {
      username,
      password: hashed,
      role,
      // no originalPassword
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await mongoose.connection.collection("users").insertOne(doc);
    console.log("Admin user created with id:", result.insertedId);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Failed to create admin:", err);
    try {
      await mongoose.disconnect();
    } catch (e) {}
    process.exit(1);
  }
}

if (require.main === module) main();
