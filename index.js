// start of installing files i would need
const { format } = require("date-fns");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");

// End of installing files i would need

// Start of importing the files i installed

console.log(format(new Date(), "yyyyMMdd\tHH:mm:ss"));
const app = express();
dotenv.config();
app.use(express.json());
app.use(cors());
app.use(cookieParser());
app.use(bodyParser.json());
app.use(express.static("public"));
const path = require("path");

// End of importing the files i installed

// Start of connecting mongoDb database to node js

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log("Failed to connect to MongoDB", err));

// The End of connecting mongoDb database to node js................

// Start of listening to the server to connect to  node js...........................

app.listen(process.env.PORT, () => {
  console.log(`Server is connected on port ${process.env.PORT}`);
});

// End of listening to the server to connect to  node js........................

// This is the start of the nodemailer code..............................................

const transporter = nodemailer.createTransport({
  service: "gmail",
  post: Number(process.env.EMAIL_PORT),
  secure: Boolean(process.env.SECURE),
  host: process.env.HOST,
  auth: {
    user: process.env.USER, // Replace with your email
    pass: process.env.PASS, // Replace with your email password or app password
  },
});

// This is the End of the nodemailer code...................................

// This is the start of the testing of the signup...............................................

require("./user/userDetails");
require("./user/pendingUser");

const User = mongoose.model("User");
const PendingUser = mongoose.model("PendingUser");

app.post("/send-email", async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !phone || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: "Email already registered" });
  }

  const existingName = await User.findOne({ name });
  if (existingName) {
    return res.status(400).json({ message: "Username already registered" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const verificationToken = uuidv4();

  const pendingUser = new PendingUser({
    name,
    email,
    phone,
    password: hashedPassword,
    verificationToken,
  });
  await pendingUser.save();

  const verificationLink = `http://localhost:5000/verify-email?token=${verificationToken}&email=${email}&name=${name}&phone=${phone}&password=${encodeURIComponent(
    password
  )}`;

  await transporter.sendMail({
    from: process.env.HOST,
    to: email,
    subject: "Your Verification Code",
    text: `Click the following link to verify your email: ${verificationLink}`,
  });

  res.json({
    message:
      "Signup successful. Please check your email to verify your account.",
  });
});

// API to verify email using the link--------------------------

app.get("/verify-email", async (req, res) => {
  const { email, token } = req.query;
  if (!email || !token)
    return res.status(400).json({ message: "Invalid verification link." });

  const pendingUser = await PendingUser.findOne({
    email,
    verificationToken: token,
  });
  if (!pendingUser)
    return res.status(400).json({ message: "Invalid or expired token." });

  const user = new User({
    name: pendingUser.name,
    email: pendingUser.email,
    phone: pendingUser.phone,
    password: pendingUser.password,
    isVerified: true,
  });
  await user.save();
  await PendingUser.deleteOne({ email });

  // Generate a JWT token
  const jwtToken = jwt.sign({ userId: user._id }, "your-secret-key", {
    expiresIn: "1h",
  });

  res.json({
    message: "Email verified successfully. Please set up a 6-digit PIN.",
    token: jwtToken,
  });
});
// This is the End of the testing of the signup.....................................................

// This is the Signin testing...................................................

const activeSessions = new Map(); // To track user sessions and activity

// Code to track user activity
const trackActivity = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (token && activeSessions.has(token)) {
    clearTimeout(activeSessions.get(token).timeout);
    activeSessions.get(token).timeout = setTimeout(() => {
      activeSessions.delete(token);
      console.log("User has been logged out due to inactivity.");
    }, 180000); // 3 minutes inactivity logout
  }
  next();
};

app.use(trackActivity);

// API to set PIN
app.post("/set-pin", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized." });

  try {
    const decoded = jwt.verify(token, "your-secret-key");
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(400).json({ message: "User not found." });

    const { pin } = req.body;
    if (!pin || pin.length !== 6)
      return res.status(400).json({ message: "Invalid PIN." });

    const hashedPin = await bcrypt.hash(pin, 10);
    user.purchasePin = hashedPin;
    await user.save();

    res.json({ message: "PIN set successfully." });
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token." });
  }
});

// API to verify PIN during purchase (User must be logged in)
app.post("/verify-pin", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token)
    return res.status(401).json({ message: "Unauthorized. Please log in." });

  try {
    const decoded = jwt.verify(token, "your-secret-key");
    const user = await User.findById(decoded.userId);
    if (!user || !user.purchasePin)
      return res.status(400).json({ message: "Invalid request." });

    const { pin } = req.body;
    if (!pin) return res.status(400).json({ message: "PIN is required." });

    const isMatch = await bcrypt.compare(pin, user.purchasePin);
    if (!isMatch) return res.status(400).json({ message: "Invalid PIN." });

    res.json({ message: "PIN verified. Purchase authorized." });
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
});

app.post("/forgot-pin", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized." });

  try {
    const decoded = jwt.verify(token, "your_jwt_secret");
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(400).json({ message: "User not found." });

    const resetToken = uuidv4();
    user.resetPinToken = resetToken;
    user.resetPinExpires = Date.now() + 3600000;
    await user.save();

    const resetLink = `http://localhost:5000/reset-pin/${resetToken}`;
    console.log(`PIN reset link: ${resetLink}`);

    res.json({
      message: "PIN reset link generated. Check console for the link.",
    });
  } catch (error) {
    res.status(401).json({ message: "Invalid token." });
  }
});

// API to reset PIN (User clicks the link and sets a new PIN)
app.post("/reset-pin/:token", async (req, res) => {
  const { token } = req.params;
  const { newPin } = req.body;
  if (!newPin) return res.status(400).json({ message: "New PIN is required." });

  const user = await User.findOne({
    resetPinToken: token,
    resetPinExpires: { $gt: Date.now() },
  });
  if (!user)
    return res.status(400).json({ message: "Invalid or expired token." });

  const hashedPin = await bcrypt.hash(newPin, 10);
  user.purchasePin = hashedPin;
  user.resetPinToken = undefined;
  user.resetPinExpires = undefined;
  await user.save();

  res.json({ message: "PIN has been reset successfully." });
});


// This is login code

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password are required" });

  const user = await User.findOne({ email });
  if (!user)
    return res.status(400).json({ message: "Invalid email or password" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch)
    return res.status(400).json({ message: "Invalid email or password" });

  if (!user.isVerified)
    return res.status(400).json({ message: "Please verify your email first" });

  const token = jwt.sign({ userId: user._id }, "your-secret-key", {
    expiresIn: "1h",
  });
  activeSessions.set(token, {
    userId: user._id,
    timeout: setTimeout(() => {
      activeSessions.delete(token);
    }, 180000), // Logout after 3 minutes of inactivity
  });
  res.json({ message: "Login successful", token });
  console.log("User logged in", token)
});

// API to logout

app.post("/logout", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (token && activeSessions.has(token)) {
    clearTimeout(activeSessions.get(token).timeout);
    activeSessions.delete(token);
    console.log("User has been logged out successfully.");
    return res.redirect("http://your-frontend-homepage.com"); // Redirect to homepage
  }
  res.status(400).json({ message: "Invalid token or user already logged out" });
});

// This is the End of the testing of the signin

// This is the forgot password code starting ...................................................

// API to request password reset
app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required." });

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "User not found." });

  const resetToken = uuidv4();
  user.resetPasswordToken = resetToken;
  user.resetPasswordExpires = Date.now() + 3600000; // 1-hour expiration
  await user.save();

  const resetLink = `http://localhost:5000/reset-password/${resetToken}`;
  console.log(`Password reset link: ${resetLink}`);
  // Send email with reset link
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.USER,
      pass: process.env.PASS,
    },
  });

  const mailOptions = {
    from: process.env.USER,
    to: user.email,
    subject: "Password Reset",
    text: `Click the following link to reset your password: ${resetLink}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ message: "Error sending email." });
    }
    res.json({ message: "Password reset email sent. Check your inbox." });
  });
});

// Serve the reset password form automatically
app.get("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() },
  });
  if (!user) return res.status(400).send("Invalid or expired token.");

  res.sendFile(path.join(__dirname, "public", "reset-password.html"));
});

// API to reset password
app.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;
  if (!newPassword)
    return res.status(400).json({ message: "New password is required." });

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() },
  });
  if (!user)
    return res.status(400).json({ message: "Invalid or expired token." });

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.json({
    message:
      "Password has been reset successfully. You can now log in with the new password.",
  });
});
// This is the forgot password code Ending ...................................................
