const express = require("express");
const router = express.Router();
const User = require("../models/user_model");
const bcrypt = require("bcryptjs");
const { generateToken, verifyToken } = require("../middleware/auth");

// ✅ User Signup
router.post("/signup", async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      ...rest,
      password: hashedPassword,
    });

    await newUser.save();

    const token = generateToken({
      id: newUser._id,
      email: newUser.email,
      role: "user",
    });

    res.json({
      message: "User registered successfully!",
      token,
      user: { id: newUser._id, email: newUser.email, name: newUser.name },
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ✅ User Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User does not exist!" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials!" });
    }

    const token = generateToken({
      id: user._id,
      email: user.email,
      role: user.role || "user",
    });

    res.json({
      message: "Login successful!",
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        mobile_no: user.mobile_no,
        role: user.role || "user",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Get user profile (protected)
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Update user profile (protected)
router.put("/profile", verifyToken, async (req, res) => {
  try {
    const { name, email, mobile_no, phone, savedAddresses } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name) user.name = name;
    if (email) user.email = email;
    if (mobile_no) user.mobile_no = mobile_no;
    if (phone) user.phone = phone;
    if (savedAddresses) user.savedAddresses = savedAddresses;

    await user.save();
    const updatedUser = await User.findById(req.user.id).select("-password");
    res.json({ message: "Profile updated!", user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
