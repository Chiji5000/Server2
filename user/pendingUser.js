const mongoose = require("mongoose");

const PendingUserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  verificationToken: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const PendingUser = mongoose.model("PendingUser", PendingUserSchema);