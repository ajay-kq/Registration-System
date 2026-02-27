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

// ─── Counter (sequential FMUID) ───────────────────────────────────────────────
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
  registrationNumber: { type: Number },
  registrationId: { type: String },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  location: { type: String, default: "" },
  address: { type: String, default: "" },
  pincode: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }
});
// NOTE: No unique:true here — we do explicit duplicate checks below
// to avoid serverless model-cache issues with index enforcement
const User = mongoose.models.User || mongoose.model("User", UserSchema);

// ─── Normalise helpers ────────────────────────────────────────────────────────
function normaliseEmail(e) { return (e || "").toLowerCase().trim(); }
function normalisePhone(p) { return (p || "").replace(/\s+/g, "").trim(); }

// ─── Slack ────────────────────────────────────────────────────────────────────
async function sendSlack({ regId, name, email, phone, location, address, pincode }) {
  if (!process.env.SLACK_WEBHOOK) return;
  try {
    await axios.post(process.env.SLACK_WEBHOOK, {
      text:
        `*New Registration Details:-*\n` +
        `*Member ID:* ${regId}\n` +
        `*Full Name:* ${name}\n` +
        `*Email Address:* ${email}\n` +
        `*Phone Number:* ${phone}\n` +
        `*Location:* ${location}\n` +
        `*Address:* ${address}\n` +
        `*Pin code:* ${pincode}`
    }, { headers: { "Content-Type": "application/json" } });
  } catch (e) { console.error("Slack error:", e.message); }
}

// ─── Email ────────────────────────────────────────────────────────────────────
async function sendEmail({ name, email, phone, regId }) {
  if (!process.env.EMAIL || !process.env.EMAIL_PASS) return;
  try {
    const t = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL, pass: process.env.EMAIL_PASS }
    });
    const wa = process.env.WHATSAPP_LINK || "#";
    await t.sendMail({
      from: `"RC Aquatics Registration" <${process.env.EMAIL}>`,
      to: email,
      subject: "Welcome to RC Aquatics Family!!!",
      html: `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0fdf4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08);max-width:600px;width:100%">
<tr><td style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:36px 32px;text-align:center">
  <h1 style="color:#fff;margin:0;font-size:26px">🐠 RC Aquatics</h1>
  <p style="color:rgba(255,255,255,.85);margin:8px 0 0;font-size:14px">Family Registration Confirmation</p>
</td></tr>
<tr><td style="padding:36px 36px 24px">
  <p style="color:#374151;font-size:16px;margin:0 0 20px">Dear <strong>${name}</strong>,</p>
  <p style="color:#374151;font-size:16px;margin:0 0 24px;line-height:1.6"><strong>Welcome to RC Aquatics Family!!!</strong></p>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:28px">
    <tr><td>
      <p style="color:#15803d;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin:0 0 4px">Your RCAFM-ID</p>
      <p style="font-size:24px;font-weight:700;color:#22c55e;margin:0 0 14px">${regId}</p>
      <table width="100%" cellpadding="0" cellspacing="4" style="border-top:1px solid #bbf7d0;padding-top:12px">
        <tr><td style="color:#6b7280;font-size:13px;width:130px">Email Address:</td><td style="color:#111827;font-size:13px;font-weight:600">${email}</td></tr>
        <tr><td style="color:#6b7280;font-size:13px;padding-top:6px">Phone Number:</td><td style="color:#111827;font-size:13px;font-weight:600;padding-top:6px">${phone}</td></tr>
      </table>
    </td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding-bottom:12px">
      <a href="${wa}" style="background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;padding:14px 36px;text-decoration:none;border-radius:50px;font-weight:700;font-size:15px;display:inline-block">💬 Join WhatsApp Group</a>
    </td></tr>
    <tr><td align="center"><p style="color:#6b7280;font-size:13px;margin:0">To get the latest updates of the fishes and offers.</p></td></tr>
  </table>
</td></tr>
<tr><td style="background:#f0fdf4;border-top:1px solid #dcfce7;padding:24px 36px;text-align:center">
  <p style="color:#86efac;font-size:13px;margin:0;line-height:1.6">Thank you for trusting us and helping us to grow up! 🙏<br><strong style="color:#22c55e">RC Aquatics Team</strong></p>
</td></tr>
</table></td></tr></table></body></html>`
    });
  } catch (e) { console.error("Email error:", e.message); }
}

// ─── Google Sheets ────────────────────────────────────────────────────────────
async function postToSheets({ sNo, date, time, registrationId, name, email, phone, location, address, pincode }) {
  if (!process.env.GOOGLE_SHEET_WEBHOOK) return "skipped";
  try {
    const body = JSON.stringify({ sNo, date, time, registrationId, name, email, phone, location, address, pincode, contactNumber: phone });
    const url = process.env.GOOGLE_SHEET_WEBHOOK;
    let r;
    try {
      r = await axios.post(url, body, { headers: { "Content-Type": "application/json" }, maxRedirects: 0, validateStatus: s => s >= 200 && s < 300 });
    } catch (re) {
      if (re.response && (re.response.status === 302 || re.response.status === 303)) {
        r = await axios.post(re.response.headers.location, body, { headers: { "Content-Type": "application/json" }, maxRedirects: 5 });
      } else throw re;
    }
    return "ok: " + JSON.stringify(r.data);
  } catch (e) { return "error: " + e.message; }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);

  // Set CORS and Security headers
  const allowedOrigins = ['https://rsaquatics-join-self.vercel.app', 'https://registration-system-self.vercel.app'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "https://rsaquatics-join-self.vercel.app"); // Fallback to new origin
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  try {
    await connectToDatabase();

    const { name, email, phone, location = "", address = "", pincode = "" } = req.body || {};
    if (!name || !email || !phone) {
      return res.status(400).json({ success: false, message: "Name, email and phone are required." });
    }

    const emailKey = normaliseEmail(email);
    const phoneKey = normalisePhone(phone);

    // ── Duplicate check: email ───────────────────────────────────────
    const byEmail = await User.findOne({ email: emailKey }).lean();
    if (byEmail) {
      return res.status(409).json({
        success: false, duplicate: true, field: "email",
        message: "This email address is already registered."
      });
    }

    // ── Duplicate check: phone ───────────────────────────────────────
    const byPhone = await User.findOne({ phone: phoneKey }).lean();
    if (byPhone) {
      return res.status(409).json({
        success: false, duplicate: true, field: "phone",
        message: "This phone number is already registered."
      });
    }

    // ── Get sequential ID ────────────────────────────────────────────
    const { label: regId, number: sNo } = await getNextFMUID();

    // ── Save ─────────────────────────────────────────────────────────
    await User.create({
      registrationNumber: sNo,
      registrationId: regId,
      name: name.trim(),
      email: emailKey,
      phone: phoneKey,
      location: location.trim(),
      address: address.trim(),
      pincode: pincode.trim()
    });

    // ── Date / Time ──────────────────────────────────────────────────
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

    // ── Notify: Sheets + Slack + Email ───────────────────────────────
    const [sheetsStatus] = await Promise.all([
      postToSheets({ sNo, date: dateStr, time: timeStr, registrationId: regId, name: name.trim(), email: emailKey, phone: phoneKey, location: location.trim(), address: address.trim(), pincode: pincode.trim() }),
      sendSlack({ regId, name: name.trim(), email: emailKey, phone: phoneKey, location: location.trim(), address: address.trim(), pincode: pincode.trim() }),
      sendEmail({ name: name.trim(), email: emailKey, phone: phoneKey, regId })
    ]);

    console.log("Sheets:", sheetsStatus);

    return res.status(200).json({
      success: true,
      regId,
      whatsappLink: process.env.WHATSAPP_LINK || "#",
      sheetsStatus
    });

  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error: " + err.message });
  }
};
