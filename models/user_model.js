const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    mobile_no: { type: String },
    phone: { type: String },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    savedAddresses: [
      {
        label: { type: String, default: "Home" },
        address: { type: String },
      },
    ],
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
module.exports = User;