#!/usr/bin/env node
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/trackmymess";

function printUsageAndExit() {
  console.log(
    "\nUsage: node scripts/createUser.js --username <username> --password <password> --role <admin|owner> [--messId <messId>]\n"
  );
  process.exit(1);
}

function parseArgs() {
  const args = {};
  const parts = process.argv.slice(2);

  // First parse any --key value pairs
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p.startsWith("--")) continue;
    const key = p.slice(2);
    const next = parts[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = true; // flag
    }
  }

  // If user supplied positional args (no flags), accept: username password role [messId]
  // Example: node scripts/createUser.js alice secret admin 650f1...   OR: node scripts/createUser.js alice secret admin
  const nonFlagParts = parts.filter((p) => !p.startsWith("--"));
  if (!args.username && nonFlagParts.length >= 3) {
    args.username = nonFlagParts[0];
    args.password = nonFlagParts[1];
    args.role = nonFlagParts[2];
    if (nonFlagParts[3]) args.messId = nonFlagParts[3];
  }

  return args;
}

async function main() {
  const { username, password, role, messId } = parseArgs();

  if (!username || !password || !role) {
    console.error("Error: --username, --password and --role are required");
    printUsageAndExit();
  }

  if (!["admin", "owner"].includes(role)) {
    console.error('Error: --role must be either "admin" or "owner"');
    printUsageAndExit();
  }

  const isDry = parseArgs().dry === true || parseArgs().dry === "true";

  // validate messId if provided
  if (messId) {
    if (!mongoose.isValidObjectId(messId)) {
      console.error("Error: --messId is not a valid ObjectId");
      printUsageAndExit();
    }
  }

  try {
    if (!isDry) {
      await connectDB(MONGO_URI);

      const existing = await User.findOne({ username }).lean();
      if (existing) {
        console.error(
          `User with username "${username}" already exists (id=${existing._id}).`
        );
        await mongoose.disconnect();
        process.exit(1);
      }

      const user = new User({
        username,
        password,
        role,
        messId: messId || null,
      });
      await user.save();

      const out = user.toObject();
      if (out.password) out.password = "<redacted>";

      console.log(
        "\n✅ User created successfully:\n",
        JSON.stringify(out, null, 2)
      );

      await mongoose.disconnect();
      process.exit(0);
    } else {
      // dry-run: don't connect or persist, just show what would be created
      console.log("\n--dry mode: user would be created with:");
      const preview = {
        username,
        password: "<redacted>",
        role,
        messId: messId || null,
      };
      console.log(JSON.stringify(preview, null, 2));
      process.exit(0);
    }

    const out = user.toObject();
    if (out.password) out.password = "<redacted>";

    console.log(
      "\n✅ User created successfully:\n",
      JSON.stringify(out, null, 2)
    );

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Failed to create user:", err.message || err);
    try {
      await mongoose.disconnect();
    } catch (e) {
      // ignore
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
