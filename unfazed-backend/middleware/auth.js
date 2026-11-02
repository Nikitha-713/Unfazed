
const jwt = require("jsonwebtoken");
const Therapist = require("../models/Therapist");

async function protect(req, res, next) {
  try {
    // Check server configuration
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Server authentication configuration error."
      });
    }

    // Get authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    // Extract token
    const token = authHeader.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing."
      });
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (!decoded.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token."
      });
    }

    // Find therapist in MongoDB
    const therapist = await Therapist.findById(decoded.id);

    if (!therapist) {
      return res.status(401).json({
        success: false,
        message: "Therapist account not found."
      });
    }

    // Attach therapist to request
    req.therapist = therapist;

    next();

  } catch (error) {
    console.error("Authentication error:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please log in again."
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid authentication token."
    });
  }
}

module.exports = protect;
