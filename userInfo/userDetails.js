const mongoose = require("mongoose");

const userDetailsSchema = new mongoose.Schema(
    {
        username: String,
        email: String,
        phoneNo: String,
    },
    {
        collation: "UserInfo",
    }
);

mongoose.model("UserInfo", userDetailsSchema);
