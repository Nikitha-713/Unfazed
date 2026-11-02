const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const protect = require("../middleware/auth");
const Therapist = require("../models/Therapist");

const router = express.Router();
router.use(protect);

const { Schema } = mongoose;

// ==========================================
// DATABASE MODELS
// ==========================================

const clientSchema = new Schema({
  therapist: {
    type: Schema.Types.ObjectId,
    ref: "Therapist",
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 254
  },
  status: {
    type: String,
    enum: ["Active", "Inactive"],
    default: "Active"
  }
}, { timestamps: true });

clientSchema.index(
  { therapist: 1, email: 1 },
  { unique: true }
);

const appointmentSchema = new Schema({
  therapist: {
    type: Schema.Types.ObjectId,
    ref: "Therapist",
    required: true,
    index: true
  },
  client: {
    type: Schema.Types.ObjectId,
    ref: "Client",
    required: true
  },
  date: { type: String, required: true },
  time: { type: String, required: true },
  status: {
    type: String,
    enum: ["Scheduled", "Completed", "Cancelled"],
    default: "Scheduled"
  },
  title: {
    type: String,
    trim: true,
    maxlength: 120,
    default: "Therapy session"
  }
}, { timestamps: true });

const noteSchema = new Schema({
  therapist: {
    type: Schema.Types.ObjectId,
    ref: "Therapist",
    required: true,
    index: true
  },
  client: {
    type: Schema.Types.ObjectId,
    ref: "Client",
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  text: {
    type: String,
    required: true,
    maxlength: 10000
  },
  visibility: {
    type: String,
    enum: ["private", "shared"],
    default: "private"
  }
}, { timestamps: true });

const paymentSchema = new Schema({
  therapist: {
    type: Schema.Types.ObjectId,
    ref: "Therapist",
    required: true,
    index: true
  },
  client: {
    type: Schema.Types.ObjectId,
    ref: "Client",
    required: true
  },
  appointment: {
    type: Schema.Types.ObjectId,
    ref: "Appointment"
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  currency: {
    type: String,
    default: "INR"
  },
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  paymentId: {
    type: String,
    default: ""
  },
  status: {
    type: String,
    enum: ["Created", "Paid", "Failed"],
    default: "Created"
  }
}, { timestamps: true });

const messageSchema = new Schema({
  therapist: {
    type: Schema.Types.ObjectId,
    ref: "Therapist",
    required: true,
    index: true
  },
  client: {
    type: Schema.Types.ObjectId,
    ref: "Client",
    required: true
  },
  sender: {
    type: String,
    enum: ["therapist", "client"],
    default: "therapist"
  },
  body: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3000
  },
  read: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

const subscriptionSchema = new Schema({
  therapist: {
    type: Schema.Types.ObjectId,
    ref: "Therapist",
    required: true,
    unique: true
  },
  plan: {
    type: String,
    enum: ["free", "professional", "premium"],
    default: "free"
  },
  status: {
    type: String,
    enum: ["active", "demo"],
    default: "active"
  },
  startedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const Client =
  mongoose.models.Client ||
  mongoose.model("Client", clientSchema);

const Appointment =
  mongoose.models.Appointment ||
  mongoose.model("Appointment", appointmentSchema);

const ClinicalNote =
  mongoose.models.ClinicalNote ||
  mongoose.model("ClinicalNote", noteSchema);

const Payment =
  mongoose.models.Payment ||
  mongoose.model("Payment", paymentSchema);

const Message =
  mongoose.models.Message ||
  mongoose.model("Message", messageSchema);

const Subscription =
  mongoose.models.Subscription ||
  mongoose.model("Subscription", subscriptionSchema);

// ==========================================
// COMMON HELPERS
// ==========================================

const owner = (req) => ({
  therapist: req.therapist._id
});

const validId = (id) =>
  mongoose.isValidObjectId(id);

const fail = (res, error, message = "Request failed") => {
  console.error(message, error.message);

  return res.status(500).json({
    success: false,
    message
  });
};

// ==========================================
// SUBSCRIPTION PLAN CONFIGURATION
// ==========================================

const SUBSCRIPTION_PLANS = {
  free: {
    name: "Free",
    price: 0,
    features: {
      clientManagement: true,
      appointments: true,
      clinicalNotes: true,
      payments: false,
      messaging: false,
      analytics: "basic"
    },
    limits: {
      clients: 10,
      notes: 20
    }
  },

  professional: {
    name: "Professional",
    price: 499,
    features: {
      clientManagement: true,
      appointments: true,
      clinicalNotes: true,
      payments: true,
      messaging: true,
      analytics: "advanced"
    },
    limits: {
      clients: 100,
      notes: 500
    }
  },

  premium: {
    name: "Premium",
    price: 999,
    features: {
      clientManagement: true,
      appointments: true,
      clinicalNotes: true,
      payments: true,
      messaging: true,
      analytics: "advanced"
    },
    limits: {
      clients: -1,
      notes: -1
    }
  }
};

// ==========================================
// ENTITLEMENT SERVICE
// ==========================================

async function getTherapistEntitlements(therapistId) {
  let subscription = await Subscription.findOne({
    therapist: therapistId
  });

  if (!subscription) {
    subscription = await Subscription.create({
      therapist: therapistId,
      plan: "free",
      status: "active"
    });
  }

  const plan = SUBSCRIPTION_PLANS[subscription.plan];

  if (!plan) {
    throw new Error("Invalid subscription plan");
  }

  return {
    subscription,
    features: plan.features,
    limits: plan.limits,
    plan
  };
}

function requireFeature(feature) {
  return async (req, res, next) => {
    try {
      const entitlements = await getTherapistEntitlements(
        req.therapist._id
      );

      if (entitlements.features[feature] !== true) {
        return res.status(403).json({
          success: false,
          message: `Upgrade your plan to access ${feature}.`
        });
      }

      req.entitlements = entitlements;
      next();
    } catch (error) {
      fail(res, error, "Could not check subscription access");
    }
  };
}

// ==========================================
// CLIENT MANAGEMENT
// ==========================================

router.get("/clients", async (req, res) => {
  try {
    const clients = await Client.find(owner(req))
      .sort({ createdAt: -1 });

    res.json({ success: true, clients });
  } catch (e) {
    fail(res, e, "Could not load clients");
  }
});

router.post("/clients", async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required"
      });
    }

    const entitlements = await getTherapistEntitlements(
      req.therapist._id
    );

    const limit = entitlements.limits.clients;

    if (limit !== -1) {
      const count = await Client.countDocuments(owner(req));

      if (count >= limit) {
        return res.status(403).json({
          success: false,
          message: `Your ${entitlements.subscription.plan} plan allows ${limit} clients. Please upgrade.`
        });
      }
    }

    const client = await Client.create({
      ...owner(req),
      name: name.trim(),
      email: email.trim().toLowerCase()
    });

    res.status(201).json({
      success: true,
      client
    });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "That email is already used for one of your clients"
      });
    }

    fail(res, e, "Could not create client");
  }
});

router.put("/clients/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid client ID"
      });
    }

    const updates = {};

    if (req.body.name !== undefined) {
      updates.name = String(req.body.name).trim();
    }

    if (req.body.email !== undefined) {
      updates.email = String(req.body.email).trim().toLowerCase();
    }

    if (req.body.status !== undefined) {
      updates.status = req.body.status;
    }

    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, ...owner(req) },
      updates,
      { new: true, runValidators: true }
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found"
      });
    }

    res.json({ success: true, client });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "That email is already used"
      });
    }

    fail(res, e, "Could not update client");
  }
});

router.delete("/clients/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid client ID"
      });
    }

    const client = await Client.findOneAndDelete({
      _id: req.params.id,
      ...owner(req)
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found"
      });
    }

    res.json({
      success: true,
      message: "Client deleted"
    });
  } catch (e) {
    fail(res, e, "Could not delete client");
  }
});

// ==========================================
// APPOINTMENTS
// ==========================================

router.get("/appointments", async (req, res) => {
  try {
    const appointments = await Appointment.find(owner(req))
      .populate("client", "name email")
      .sort({ date: 1, time: 1 });

    res.json({ success: true, appointments });
  } catch (e) {
    fail(res, e, "Could not load appointments");
  }
});

router.post("/appointments", async (req, res) => {
  try {
    const { clientId, date, time, title } = req.body;

    if (!validId(clientId) || !date || !time) {
      return res.status(400).json({
        success: false,
        message: "Client, date and time are required"
      });
    }

    const client = await Client.findOne({
      _id: clientId,
      ...owner(req)
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found"
      });
    }

    const appointment = await Appointment.create({
      ...owner(req),
      client: client._id,
      date,
      time,
      title: title || "Therapy session"
    });

    await appointment.populate("client", "name email");

    res.status(201).json({
      success: true,
      appointment
    });
  } catch (e) {
    fail(res, e, "Could not create appointment");
  }
});

router.put("/appointments/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID"
      });
    }

    const updates = {};

    for (const key of ["date", "time", "title", "status"]) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (req.body.clientId !== undefined) {
      if (!validId(req.body.clientId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid client ID"
        });
      }

      const client = await Client.findOne({
        _id: req.body.clientId,
        ...owner(req)
      });

      if (!client) {
        return res.status(404).json({
          success: false,
          message: "Client not found"
        });
      }

      updates.client = client._id;
    }

    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id, ...owner(req) },
      updates,
      { new: true, runValidators: true }
    ).populate("client", "name email");

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found"
      });
    }

    res.json({ success: true, appointment });
  } catch (e) {
    fail(res, e, "Could not update appointment");
  }
});

router.delete("/appointments/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID"
      });
    }

    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id, ...owner(req) },
      { status: "Cancelled" },
      { new: true }
    );

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found"
      });
    }

    res.json({
      success: true,
      appointment,
      message: "Appointment cancelled"
    });
  } catch (e) {
    fail(res, e, "Could not cancel appointment");
  }
});

// ==========================================
// CLINICAL NOTES
// ==========================================

router.get("/notes", async (req, res) => {
  try {
    const notes = await ClinicalNote.find(owner(req))
      .populate("client", "name")
      .sort({ updatedAt: -1 });

    res.json({ success: true, notes });
  } catch (e) {
    fail(res, e, "Could not load notes");
  }
});

router.post("/notes", async (req, res) => {
  try {
    const {
      clientId,
      title,
      text,
      visibility = "private"
    } = req.body;

    if (!validId(clientId) || !title?.trim() || !text?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Client, title and note content are required"
      });
    }

    const entitlements = await getTherapistEntitlements(
      req.therapist._id
    );

    const limit = entitlements.limits.notes;

    if (limit !== -1) {
      const count = await ClinicalNote.countDocuments(owner(req));

      if (count >= limit) {
        return res.status(403).json({
          success: false,
          message: `Your plan allows ${limit} clinical notes. Please upgrade.`
        });
      }
    }

    const client = await Client.findOne({
      _id: clientId,
      ...owner(req)
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found"
      });
    }

    const note = await ClinicalNote.create({
      ...owner(req),
      client: client._id,
      title: title.trim(),
      text: text.trim(),
      visibility
    });

    res.status(201).json({ success: true, note });
  } catch (e) {
    fail(res, e, "Could not save note");
  }
});

router.put("/notes/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid note ID"
      });
    }

    const updates = {};

    for (const key of ["title", "text", "visibility"]) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (req.body.clientId !== undefined) {
      if (!validId(req.body.clientId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid client ID"
        });
      }

      const client = await Client.findOne({
        _id: req.body.clientId,
        ...owner(req)
      });

      if (!client) {
        return res.status(404).json({
          success: false,
          message: "Client not found"
        });
      }

      updates.client = client._id;
    }

    const note = await ClinicalNote.findOneAndUpdate(
      { _id: req.params.id, ...owner(req) },
      updates,
      { new: true, runValidators: true }
    );

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found"
      });
    }

    res.json({ success: true, note });
  } catch (e) {
    fail(res, e, "Could not update note");
  }
});

router.delete("/notes/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid note ID"
      });
    }

    const note = await ClinicalNote.findOneAndDelete({
      _id: req.params.id,
      ...owner(req)
    });

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found"
      });
    }

    res.json({
      success: true,
      message: "Note deleted"
    });
  } catch (e) {
    fail(res, e, "Could not delete note");
  }
});

// ==========================================
// PAYMENTS - RAZORPAY TEST MODE
// ==========================================

router.post(
  "/payments/order",
  requireFeature("payments"),
  async (req, res) => {
    try {
      if (
        !process.env.RAZORPAY_KEY_ID ||
        !process.env.RAZORPAY_KEY_SECRET
      ) {
        return res.status(503).json({
          success: false,
          message: "Razorpay test credentials are missing"
        });
      }

      const { clientId, appointmentId, amount } = req.body;
      const numericAmount = Number(amount);

      if (
        !validId(clientId) ||
        !Number.isFinite(numericAmount) ||
        numericAmount < 1 ||
        numericAmount > 1000000
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid client and amount are required"
        });
      }

      const client = await Client.findOne({
        _id: clientId,
        ...owner(req)
      });

      if (!client) {
        return res.status(404).json({
          success: false,
          message: "Client not found"
        });
      }

      if (appointmentId) {
        if (!validId(appointmentId)) {
          return res.status(400).json({
            success: false,
            message: "Invalid appointment ID"
          });
        }

        const appointment = await Appointment.findOne({
          _id: appointmentId,
          ...owner(req)
        });

        if (!appointment) {
          return res.status(404).json({
            success: false,
            message: "Appointment not found"
          });
        }
      }

      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      });

      const order = await razorpay.orders.create({
        amount: Math.round(numericAmount * 100),
        currency: "INR",
        receipt: `unfazed_${Date.now()}`
      });

      await Payment.create({
        ...owner(req),
        client: client._id,
        appointment: appointmentId || undefined,
        amount: numericAmount,
        orderId: order.id,
        status: "Created"
      });

      res.status(201).json({
        success: true,
        order,
        keyId: process.env.RAZORPAY_KEY_ID
      });
    } catch (e) {
      fail(res, e, "Could not create payment order");
    }
  }
);

router.post(
  "/payments/verify",
  requireFeature("payments"),
  async (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({
        success: false,
        message: "Payment verification is not configured"
      });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment verification details are required"
      });
    }

    const payment = await Payment.findOne({
      orderId: razorpay_order_id,
      ...owner(req)
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment order not found"
      });
    }

    if (payment.status === "Paid") {
      return res.json({
        success: true,
        message: "Payment already verified",
        payment
      });
    }

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const a = Buffer.from(expected);
    const b = Buffer.from(razorpay_signature);

    if (
      a.length !== b.length ||
      !crypto.timingSafeEqual(a, b)
    ) {
      payment.status = "Failed";
      await payment.save();

      return res.status(400).json({
        success: false,
        message: "Payment signature verification failed"
      });
    }

    payment.status = "Paid";
    payment.paymentId = razorpay_payment_id;

    await payment.save();

    res.json({
      success: true,
      message: "Payment verified",
      payment
    });
  } catch (e) {
    fail(res, e, "Could not verify payment");
  }
});

router.get(
  "/payments",
  requireFeature("payments"),
  async (req, res) => {
  try {
    const payments = await Payment.find(owner(req))
      .populate("client", "name email")
      .sort({ createdAt: -1 });

    res.json({ success: true, payments });
  } catch (e) {
    fail(res, e, "Could not load payments");
  }
});
// ==========================================
// PROFILE
// ==========================================

router.get("/profile", async (req, res) => {
  try {
    const profile = await Therapist.findById(req.therapist._id)
      .select("-passwordHash");

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Therapist not found"
      });
    }

    res.json({ success: true, profile });
  } catch (e) {
    fail(res, e, "Could not load profile");
  }
});

router.put("/profile", async (req, res) => {
  try {
    const allowed = ["name", "bio", "specializations", "languages"];
    const updates = {};

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (typeof req.body[key] !== "string") {
          return res.status(400).json({
            success: false,
            message: `Invalid ${key}`
          });
        }
        updates[key] = req.body[key].trim();
      }
    }

    const profile = await Therapist.findByIdAndUpdate(
      req.therapist._id,
      updates,
      { new: true, runValidators: true }
    ).select("-passwordHash");

    res.json({ success: true, profile });
  } catch (e) {
    fail(res, e, "Could not update profile");
  }
});

// ==========================================
// ANALYTICS
// ==========================================

router.get("/analytics", async (req, res) => {
  try {
    const filter = owner(req);

    const [
      totalClients,
      totalAppointments,
      totalNotes,
      entitlements
    ] = await Promise.all([
      Client.countDocuments(filter),
      Appointment.countDocuments(filter),
      ClinicalNote.countDocuments(filter),
      getTherapistEntitlements(req.therapist._id)
    ]);

    res.json({
      success: true,
      analytics: {
        totalClients,
        totalAppointments,
        totalNotes,
        paidAmount: 0,
        paidTransactions: 0,
        upcomingAppointments: []
      }
    });
  } catch (e) {
    fail(res, e, "Could not load analytics");
  }
});

// ==========================================
// SUBSCRIPTION DETAILS
// ==========================================

router.get("/subscription/plans", (req, res) => {
  res.json({
    success: true,
    plans: Object.entries(SUBSCRIPTION_PLANS).map(
      ([id, plan]) => ({ id, ...plan })
    )
  });
});

router.get("/subscription", async (req, res) => {
  try {
    const entitlements = await getTherapistEntitlements(
      req.therapist._id
    );

    res.json({
      success: true,
      subscription: entitlements.subscription,
      plan: {
        ...entitlements.plan,
        id: entitlements.subscription.plan
      }
    });
  } catch (e) {
    fail(res, e, "Could not load subscription");
  }
});
// ==========================================
// MESSAGES
// ==========================================

router.get(
  "/messages/:clientId",
  requireFeature("messaging"),
  async (req, res) => {
    try {
      if (!validId(req.params.clientId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid client ID"
        });
      }

      const client = await Client.findOne({
        _id: req.params.clientId,
        ...owner(req)
      });

      if (!client) {
        return res.status(404).json({
          success: false,
          message: "Client not found"
        });
      }

      const messages = await Message.find({
        ...owner(req),
        client: client._id
      })
        .sort({ createdAt: 1 })
        .limit(300);

      res.json({ success: true, messages });
    } catch (e) {
      fail(res, e, "Could not load messages");
    }
  }
);

router.post(
  "/messages",
  requireFeature("messaging"),
  async (req, res) => {
    try {
      const { clientId, body } = req.body;

      if (!validId(clientId) || !body?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Client and message are required"
        });
      }

      const client = await Client.findOne({
        _id: clientId,
        ...owner(req)
      });

      if (!client) {
        return res.status(404).json({
          success: false,
          message: "Client not found"
        });
      }

      const message = await Message.create({
        ...owner(req),
        client: client._id,
        sender: "therapist",
        body: body.trim()
      });

      const io = req.app.get("io");

      if (io) {
        io.to(`therapist:${req.therapist._id}`)
          .emit("message:new", message);
      }

      return res.status(201).json({
        success: true,
        message
      });

    } catch (e) {
      fail(res, e, "Could not send message");
    }
  }
);

// DEMO PLAN SELECTION
// This does NOT charge money or verify a Razorpay subscription.

router.post("/subscription/select", async (req, res) => {
  try {
    const { plan } = req.body;

    if (
      typeof plan !== "string" ||
      !Object.prototype.hasOwnProperty.call(
        SUBSCRIPTION_PLANS,
        plan
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription plan"
      });
    }

    const subscription = await Subscription.findOneAndUpdate(
      { therapist: req.therapist._id },
      {
        $set: {
          plan,
          status: plan === "free" ? "active" : "demo",
          startedAt: new Date()
        }
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    res.json({
      success: true,
      message: "Subscription plan updated in demo mode",
      subscription,
      plan: {
        ...SUBSCRIPTION_PLANS[plan],
        id: plan
      }
    });
  } catch (e) {
    fail(res, e, "Could not update subscription");
  }
});

module.exports = router;