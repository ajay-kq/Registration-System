const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");
const axios = require("axios"); // Added for Google Sheets Webhook
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const app = express();
app.use(cors()); // Permissive for debugging Vercel-Render connection
app.use(express.json());

// Health Check Route
app.get("/", (req, res) => {
  res.send("Registration System Backend is Live!");
});

// Check required env vars
const requiredEnv = ["MONGO_URI", "EMAIL", "EMAIL_PASS", "WHATSAPP_LINK", "GOOGLE_SHEET_WEBHOOK"];
requiredEnv.forEach((key) => {
  if (!process.env[key] && key !== "GOOGLE_SHEET_WEBHOOK") {
    console.error(`ERROR: Missing critical environment variable ${key}`);
    process.exit(1);
  }
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  registrationId: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", UserSchema);

app.post("/register", async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    // 1. Validation
    if (!name || !email || !phone) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const regId = "REG-" + uuidv4().slice(0, 8);

    // 2. Save to MongoDB
    await User.create({
      name,
      email,
      phone,
      registrationId: regId
    });

    // 3. Save to Google Sheets (Async - don't block registration if failure)
    if (process.env.GOOGLE_SHEET_WEBHOOK) {
      axios.post(process.env.GOOGLE_SHEET_WEBHOOK, {
        name,
        email,
        phone,
        registrationId: regId,
        date: new Date().toLocaleString()
      }).catch(err => console.error("Google Sheets Logging Failed:", err.message));
    }

    // 4. Send Confirmation Email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: `"Registration System" <${process.env.EMAIL}>`,
      to: email,
      subject: "Registration Successful",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
          <h2 style="color: #25D366;">Welcome, ${name}!</h2>
          <p>You have successfully registered. Your Registration ID is:</p>
          <div style="background: #f4f4f4; padding: 10px; font-size: 1.2em; font-weight: bold; text-align: center; border-radius: 5px;">
            ${regId}
          </div>
          <p>Please join our WhatsApp Group to stay updated:</p>
          <div style="text-align: center; margin-top: 20px;">
            <a href="${process.env.WHATSAPP_LINK}" style="background: #25D366; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Join WhatsApp Group</a>
          </div>
          <p style="font-size: 0.8em; color: #777; margin-top: 30px;">If you didn't register for this, please ignore this email.</p>
        </div>
      `
    });

    res.json({
      success: true,
      regId,
      whatsappLink: process.env.WHATSAPP_LINK
    });

  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server Running on port ${PORT}`));
