const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "20kb" }));

const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || "http://localhost:5173" }
});
app.set("io", io);

// Authenticated Socket.IO connection. Each therapist can join only their own room.
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.therapistId = decoded.id;
    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
});

io.on("connection", (socket) => {
  socket.join(`therapist:${socket.therapistId}`);
});

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "Unfazed backend is running!",
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"
  });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/workspace", require("./routes/workspace"));

async function startServer() {
  try {
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing");
    if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is missing");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully!");
    const port = process.env.PORT || 5000;
    server.listen(port, () => console.log(`Unfazed backend running on port ${port}`));
  } catch (error) {
    console.error("Startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
