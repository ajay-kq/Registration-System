const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"));

const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  registrationId: String
});

const User = mongoose.model("User", UserSchema);

app.post("/register", async (req, res) => {
  const { name, email, phone } = req.body;

  const regId = "REG-" + uuidv4().slice(0, 8);

  await User.create({
    name,
    email,
    phone,
    registrationId: regId
  });

  // Send Email
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.EMAIL,
    to: email,
    subject: "Registration Successful",
    html: `
      <h2>Welcome ${name}</h2>
      <p>Your Registration ID: <b>${regId}</b></p>
      <p>Join our WhatsApp Group:</p>
      <a href="YOUR_WHATSAPP_GROUP_LINK">Click Here</a>
    `
  });

  res.json({ success: true, regId });
});

app.listen(5000, () => console.log("Server Running"));