const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

// MongoDB Connection Cache
let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) return cachedDb;

    cachedDb = await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    return cachedDb;
}

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    registrationId: { type: String, unique: true },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model("User", UserSchema);

export default async function handler(req, res) {
    // CORS Headers for Serverless
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
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

        // 2. Save to Google Sheets (Async)
        if (process.env.GOOGLE_SHEET_WEBHOOK) {
            axios.post(process.env.GOOGLE_SHEET_WEBHOOK, {
                name,
                email,
                phone,
                registrationId: regId,
                date: new Date().toLocaleString()
            }).catch(err => console.error("Google Sheets Logging Failed:", err.message));
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
          <p>You have successfully registered. Your Registration ID is: <b>${regId}</b></p>
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
        console.error("error during registration:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
}
