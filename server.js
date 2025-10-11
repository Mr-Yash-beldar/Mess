require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const connectDB = require("./src/config/db");

// Import route placeholders (we will create these files next)
const apiRouter = require("./src/routes"); // central router (create later)

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "5mb" })); // parse JSON bodies
app.use(express.urlencoded({ extended: true }));
// Catch malformed JSON body errors and return a friendly message
app.use((err, req, res, next) => {
  if (err && err.type === "entity.parse.failed") {
    // body-parser/express.json parse error
    return res.status(400).json({ error: `Invalid JSON body: ${err.message}` });
  }
  next(err);
});
app.use(morgan("dev"));

// Static (if you serve uploads/public files later)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Healthcheck
app.get("/health", (req, res) =>
  res.json({ status: "ok", timestamp: Date.now() })
);

// API prefix — all REST endpoints will live under /api
app.use("/api", apiRouter);

// 404
app.use((req, res, next) => {
  res.status(404).json({ error: "Not Found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  const msg = err.message || "Internal Server Error";
  res.status(status).json({ error: msg });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/trackmymess";

async function start() {
  try {
    await connectDB(MONGO_URI);
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Server startup failed", err);
  }
}

start();
