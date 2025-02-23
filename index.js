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

const User = mongoose.model("User");

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

  const verificationToken = uuidv4();

  const verificationLink = `http://localhost:5000/verify-email?token=${verificationToken}&email=${email}&name=${name}&phone=${phone}&password=${encodeURIComponent(password)}`;

   await transporter.sendMail({
    from: process.env.HOST,
    to: email,
    subject: "Your Verification Code",
    text: `Click the following link to verify your email: ${verificationLink}`,
   });

  res.json({ message: "Signup successful. Please check your email to verify your account." });
  
});

// API to verify email using the link--------------------------

app.get("/verify-email", async (req, res) => {
    const { email, token, name, phone, password } = req.query;
    if (!email || !token || !name || !phone || !password) return res.status(400).json({ message: "All fields are required." });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already verified." });

    const hashedPassword = await bcrypt.hash(decodeURIComponent(password), 10);

    const user = new User({
        name,
        email,
        phone,
        password: hashedPassword,
        isVerified: true,
        verificationToken: null
    });
    await user.save();

    res.json({ message: "Email verified successfully." });
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
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "User not found" });

  const resetToken = uuidv4();
  user.resetPasswordToken = resetToken;
  await user.save();

  const resetLink = `http://localhost:5000/reset-password?token=${resetToken}&email=${email}`;
  const mailOptions = {
    from: process.env.HOST,
    to: email,
    subject: "Reset Your Password",
    text: `Click the following link to reset your password: ${resetLink}`,
  };

  await transporter.sendMail(mailOptions);
  res.json({ message: "Password reset link sent!", link: resetLink });
});

// API to reset password
app.post("/reset-password", async (req, res) => {
  const { email, token, newPassword } = req.body;
  const user = await User.findOne({ email, resetPasswordToken: token });
  if (!user)
    return res.status(400).json({ message: "Invalid or expired token" });

  user.password = await bcrypt.hash(newPassword, 10);
  user.resetPasswordToken = null;
  await user.save();
  res.json({ message: "Password reset successfully!" });
});

// This is the forgot password code Ending ...................................................