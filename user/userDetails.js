const mongoose = require("mongoose");


const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  resetPasswordToken: { type: String },
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  purchasePin: { type: String }, // Added field for PIN
  createdAt: { type: Date, default: Date.now, expires: 3000 },
});
    
const User = mongoose.model("User", UserSchema);