// start of installing files i would need

const { format } = require("date-fns");
const { v4: uuid } = require("uuid");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");

// End of installing files i would need

// Start of importing the files i installed

console.log(format(new Date(), "yyyyMMdd\tHH:mm:ss"));
console.log(uuid());
const app = express();
dotenv.config();
app.use(express.json());
app.use(cors());

// End of importing the files i installed

// Start of connecting mongoDb database to node js

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log("Failed to connect to MongoDB", err));

// The End of connecting mongoDb database to node js

// Start of listening to the server to connect to  node js
app.listen(process.env.PORT, () => {
  console.log(`Server is connected on port ${process.env.PORT}`);
});

// End of listening to the server to connect to  node js


// This is the start of testing of the postman
require("./userInfo/userDetails");

const User = mongoose.model("UserInfo");

app.post("/register", async (req, res) => {
  const { name, email, mobileNo } = req.body;
  try {
    await User.create({
      username: name,
      email: email,
      phoneNo: mobileNo,
    });
    res.send({ status: "ok" });
  } catch (error) {
    res.send({ status: "error" });
  }
});
// This is the end of testing of the postman
