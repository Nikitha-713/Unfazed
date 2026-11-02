const mongoose = require("mongoose");

const therapistSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    bio: {
      type: String,
      default: ""
    },
    specializations: {
      type: String,
      default: ""
    },
    languages: {
      type: String,
      default: "English"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Therapist", therapistSchema);