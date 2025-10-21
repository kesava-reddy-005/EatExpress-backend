const express = require("express");
const router = express.Router();
const User = require("../models/user_model");
const bcrypt = require("bcryptjs");

// ✅ User Signup
router.post("/signup", async (req, res) => {
  try {
    const { password, ...rest } = req.body;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      ...rest,
      password: hashedPassword,
    });

    await newUser.save();
    res.json({ message: "User registered successfully!" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ✅ User Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User does not exist!" });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials!" });
    }

    // ✅ If everything is fine
    res.json({ message: "Login successful!", user: { id: user._id, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
