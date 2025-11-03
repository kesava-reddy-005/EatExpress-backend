const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const Owner = require("../models/owner_model");

// ✅ Owner Registration
router.post("/register", async (req, res) => {
  try {
    const { password, ...rest } = req.body;

    // Check if email already exists
    const existingOwner = await Owner.findOne({ email: rest.email });
    if (existingOwner) {
      return res.status(400).json({ message: "Owner already exists!" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newOwner = new Owner({
      ...rest,
      password: hashedPassword,
    });

    await newOwner.save();
    res.json({ message: "Owner registered successfully!" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ✅ Owner Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if owner exists
    const owner = await Owner.findOne({ email });
    if (!owner) {
      return res.status(400).json({ message: "Owner does not exist!" });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, owner.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials!" });
    }

    // ✅ If everything is fine
    res.json({
      message: "Login successful!",
      owner: {
        id: owner._id,
        email: owner.email,
        name: owner.name,
        restaurantName: owner.restaurantName,
        mobile_no: owner.mobile_no,
        adders: owner.adders,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Get All Owners
router.get("/owners", async (req, res) => {
  try {
    const owners = await Owner.find();
    res.json(owners);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch owners" });
  }
});

// ✅ Get Single Owner (for restaurant menu page)
router.get("/:id", async (req, res) => {
  try {
    const owner = await Owner.findById(req.params.id);
    if (!owner) {
      return res.status(404).json({ message: "Restaurant not found!" });
    }

    res.json({
      _id: owner._id,
      name: owner.name,
      restaurantName: owner.restaurantName,
      email: owner.email,
      mobile_no: owner.mobile_no,
      adders: owner.adders,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch restaurant details" });
  }
});

module.exports = router;
