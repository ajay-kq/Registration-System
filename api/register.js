const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

// MongoDB Connection Cache (reuse across invocations)
let isConnected = false;

async function connectToDatabase() {
    if (isConnected) return;
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
}

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    registrationId: { type: String, unique: true },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model("User", UserSchema);

module.exports = async function handler(req, res) {
    // CORS Headers
    res.setHeader("Access-Control-Allow-Credentials", true);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method Not Allowed" });
    }

    try {
        await connectToDatabase();

        const { name, email, phone } = req.body;

        if (!name || !email || !phone) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        const regId = "REG-" + uuidv4().slice(0, 8);

        // 1. Save to MongoDB
        await User.create({ name, email, phone, registrationId: regId });

        // 2. Save to Google Sheets (non-blocking)
        if (process.env.GOOGLE_SHEET_WEBHOOK) {
            axios.post(process.env.GOOGLE_SHEET_WEBHOOK, {
                name, email, phone,
                registrationId: regId,
                date: new Date().toLocaleString()
            }).catch(err => console.error("Google Sheets Failed:", err.message));
        }

        // 3. Send Email
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
          <p>Your Registration ID: <b>${regId}</b></p>
          <div style="text-align: center; margin-top: 20px;">
            <a href="${process.env.WHATSAPP_LINK}" style="background: #25D366; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Join WhatsApp Group</a>
          </div>
        </div>
      `
        });

        return res.status(200).json({
            success: true,
            regId,
            whatsappLink: process.env.WHATSAPP_LINK
        });

    } catch (error) {
        console.error("Registration Error:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
};
