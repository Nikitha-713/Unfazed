const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Therapist = require("../models/Therapist");

const router = express.Router();

// REGISTER THERAPIST
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await Therapist.findOne({
      email: normalizedEmail
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Email is already registered."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const therapist = await Therapist.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash
    });

    const token = jwt.sign(
      { id: therapist._id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(201).json({
      success: true,
      message: "Registration successful!",
      token,
      therapist: {
        id: therapist._id,
        name: therapist.name,
        email: therapist.email
      }
    });

  } catch (error) {
    console.error("Registration error:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email is already registered."
      });
    }

    return res.status(500).json({
      success: false,
      message: "Registration failed."
    });
  }
});


// LOGIN THERAPIST
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required."
      });
    }

    const therapist = await Therapist.findOne({
      email: email.trim().toLowerCase()
    }).select("+passwordHash");

    if (!therapist) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const validPassword = await bcrypt.compare(
      password,
      therapist.passwordHash
    );

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const token = jwt.sign(
      { id: therapist._id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({
      success: true,
      message: "Login successful!",
      token,
      therapist: {
        id: therapist._id,
        name: therapist.name,
        email: therapist.email
      }
    });

  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Login failed."
    });
  }
});

module.exports = router;