const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const axios = require("axios");

// ─── MongoDB Connection Cache ─────────────────────────────────────────────────
let isConnected = false;

async function connectToDatabase() {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGO_URI);
  isConnected = true;
}

// ─── Counter Schema (sequential FMUID) ───────────────────────────────────────
const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.models.Counter || mongoose.model("Counter", CounterSchema);

async function getNextFMUID() {
  const doc = await Counter.findOneAndUpdate(
    { _id: "fmuid" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  const padded = String(doc.seq).padStart(2, "0");
  return { label: `FMUID:${padded}`, number: doc.seq };
}

// ─── User Schema ──────────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  registrationNumber: { type: Number, required: true },
  registrationId: { type: String, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  location: { type: String, default: "" },
  address: { type: String, default: "" },
  pincode: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.models.User || mongoose.model("User", UserSchema);

// ─── Slack Notification ───────────────────────────────────────────────────────
async function sendSlackNotification({ regId, name, email, phone, location, address, pincode }) {
  if (!process.env.SLACK_WEBHOOK) return;
  try {
    const text =
      `*New Registration Details:-*\n` +
      `*Member ID:* ${regId}\n` +
      `*Full Name:* ${name}\n` +
      `*Email Address:* ${email}\n` +
      `*Phone Number:* ${phone}\n` +
      `*Location:* ${location}\n` +
      `*Address:* ${address}\n` +
      `*Pin code:* ${pincode}`;
    await axios.post(process.env.SLACK_WEBHOOK, { text }, {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Slack error:", err.message);
  }
}

// ─── Email Confirmation ───────────────────────────────────────────────────────
async function sendEmail({ name, email, phone, regId }) {
  if (!process.env.EMAIL || !process.env.EMAIL_PASS) return;
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL, pass: process.env.EMAIL_PASS }
    });
    const whatsappLink = process.env.WHATSAPP_LINK || "#";
    await transporter.sendMail({
      from: `"RC Aquatics Registration" <${process.env.EMAIL}>`,
      to: email,
      subject: "Welcome to RC Aquatics Family!!!",
      html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:36px 32px;text-align:center;">
            <h1 style="color:white;margin:0;font-size:26px;letter-spacing:-0.5px;">🐠 RC Aquatics</h1>
            <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Family Registration Confirmation</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 36px 24px;">
            <p style="color:#374151;font-size:16px;margin:0 0 20px;">Dear <strong>${name}</strong>,</p>
            <p style="color:#374151;font-size:16px;margin:0 0 24px;line-height:1.6;">
              <strong>Welcome to RC Aquatics Family!!!</strong><br>
              We're thrilled to have you with us. Here are your registration details:
            </p>
            <!-- Details Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:28px;">
              <tr><td>
                <p style="color:#15803d;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Your RCAFM-ID</p>
                <p style="font-size:24px;font-weight:700;color:#22c55e;margin:0 0 16px;letter-spacing:0.5px;">${regId}</p>
                <table width="100%" cellpadding="0" cellspacing="4" style="border-top:1px solid #bbf7d0;padding-top:14px;margin-top:0;">
                  <tr>
                    <td style="color:#6b7280;font-size:13px;width:130px;">Email Address:</td>
                    <td style="color:#111827;font-size:13px;font-weight:600;">${email}</td>
                  </tr>
                  <tr>
                    <td style="color:#6b7280;font-size:13px;padding-top:6px;">Phone Number:</td>
                    <td style="color:#111827;font-size:13px;font-weight:600;padding-top:6px;">${phone}</td>
                  </tr>
                </table>
              </td></tr>
            </table>
            <!-- WhatsApp CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:12px;">
                  <a href="${whatsappLink}" style="background:linear-gradient(135deg,#25D366,#128C7E);color:white;padding:14px 36px;text-decoration:none;border-radius:50px;font-weight:700;font-size:15px;display:inline-block;box-shadow:0 6px 16px rgba(37,211,102,0.3);">
                    💬 Join WhatsApp Group
                  </a>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <p style="color:#6b7280;font-size:13px;margin:0;">To get the latest updates of the fishes and offers.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f0fdf4;border-top:1px solid #dcfce7;padding:24px 36px;text-align:center;">
            <p style="color:#86efac;font-size:13px;margin:0;line-height:1.6;">
              Thank you for trusting us and helping us to grow up! 🙏<br>
              <strong style="color:#22c55e;">RC Aquatics Team</strong>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
    });
  } catch (err) {
    console.error("Email error:", err.message);
  }
}

// ─── Google Sheets ────────────────────────────────────────────────────────────
async function postToGoogleSheets({ sNo, date, time, registrationId, name, email, phone, location, address, pincode }) {
  if (!process.env.GOOGLE_SHEET_WEBHOOK) return "skipped (no webhook configured)";
  try {
    const payload = JSON.stringify({
      sNo,
      date,
      time,
      registrationId,
      name,
      email,
      phone,
      location,
      address,
      pincode,
      contactNumber: phone
    });

    let webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK;
    let sheetsRes;
    try {
      sheetsRes = await axios.post(webhookUrl, payload, {
        headers: { "Content-Type": "application/json" },
        maxRedirects: 0,
        validateStatus: s => s < 400
      });
    } catch (redirectErr) {
      if (redirectErr.response && redirectErr.response.status === 302) {
        const redirectUrl = redirectErr.response.headers.location;
        sheetsRes = await axios.post(redirectUrl, payload, {
          headers: { "Content-Type": "application/json" },
          maxRedirects: 5
        });
      } else {
        throw redirectErr;
      }
    }
    return "success: " + JSON.stringify(sheetsRes.data);
  } catch (err) {
    return "error: " + err.message;
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  try {
    await connectToDatabase();

    const { name, email, phone, location = "", address = "", pincode = "" } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ success: false, message: "Name, email and phone are required." });
    }

    // ── Explicit duplicate checks BEFORE incrementing counter ──
    const emailNorm = email.toLowerCase().trim();
    const phoneTrim = phone.trim();

    const dupEmail = await User.findOne({ email: emailNorm });
    if (dupEmail) {
      return res.status(409).json({
        success: false, duplicate: true, field: "email",
        message: "This email address is already registered."
      });
    }

    const dupPhone = await User.findOne({ phone: phoneTrim });
    if (dupPhone) {
      return res.status(409).json({
        success: false, duplicate: true, field: "phone",
        message: "This phone number is already registered."
      });
    }

    // ── Get sequential FMUID ──
    const { label: regId, number: sNo } = await getNextFMUID();

    // ── Save to MongoDB ──
    await User.create({
      registrationNumber: sNo,
      registrationId: regId,
      name: name.trim(),
      email: emailNorm,
      phone: phoneTrim,
      location: location.trim(),
      address: address.trim(),
      pincode: pincode.trim()
    });

    // ── Date / Time ──
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

    // ── Post to Sheets + Slack + Email in parallel ──
    const [sheetsStatus] = await Promise.all([
      postToGoogleSheets({ sNo, date: dateStr, time: timeStr, registrationId: regId, name: name.trim(), email: emailNorm, phone: phoneTrim, location: location.trim(), address: address.trim(), pincode: pincode.trim() }),
      sendSlackNotification({ regId, name: name.trim(), email: emailNorm, phone: phoneTrim, location: location.trim(), address: address.trim(), pincode: pincode.trim() }),
      sendEmail({ name: name.trim(), email: emailNorm, phone: phoneTrim, regId })
    ]);

    console.log("Google Sheets Result:", sheetsStatus);

    return res.status(200).json({
      success: true,
      regId,
      whatsappLink: process.env.WHATSAPP_LINK || "#",
      sheetsStatus
    });

  } catch (error) {
    console.error("Registration Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
  }
};
