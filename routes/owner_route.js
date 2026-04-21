const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const Owner = require("../models/owner_model");
const defaultMenu = require("../utils/defaultMenu");
const { generateToken, verifyToken } = require("../middleware/auth");

/* ---------------- OWNER REGISTER ---------------- */
router.post("/register", async (req, res) => {
  try {
    const { password, ...rest } = req.body;

    const existingOwner = await Owner.findOne({ email: rest.email });
    if (existingOwner) {
      return res.status(400).json({ message: "Owner already exists!" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const ownerMenu = defaultMenu.map((item) => ({ ...item }));

    const newOwner = new Owner({
      ...rest,
      password: hashedPassword,
      menu: ownerMenu,
    });

    await newOwner.save();

    const token = generateToken({
      id: newOwner._id,
      email: newOwner.email,
      role: "owner",
    });

    res.json({ message: "Owner registered successfully!", token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/* ---------------- OWNER LOGIN ---------------- */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const owner = await Owner.findOne({ email });
    if (!owner) {
      return res.status(400).json({ message: "Owner does not exist!" });
    }

    const isMatch = await bcrypt.compare(password, owner.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials!" });
    }

    const token = generateToken({
      id: owner._id,
      email: owner.email,
      role: "owner",
    });

    res.json({
      message: "Login successful!",
      token,
      owner: {
        id: owner._id,
        email: owner.email,
        name: owner.name,
        restaurantName: owner.restaurantName,
        mobile_no: owner.mobile_no,
        adders: owner.adders,
        isOpen: owner.isOpen,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------------- GET ALL OWNERS (FOR USER PAGE) ---------------- */
router.get("/owners", async (req, res) => {
  try {
    const owners = await Owner.find(
      {},
      {
        password: 0,
        menu: 0,
      }
    );
    res.json(owners);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch owners" });
  }
});

/* ---------------- GET SINGLE OWNER ---------------- */
router.get("/:id", async (req, res) => {
  try {
    const owner = await Owner.findById(req.params.id);
    if (!owner) {
      return res.status(404).json({ message: "Restaurant not found!" });
    }
    res.json(owner);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch restaurant details" });
  }
});

/* ---------------- TOGGLE OPEN/CLOSE ---------------- */
router.put("/toggle-status/:id", verifyToken, async (req, res) => {
  try {
    const owner = await Owner.findById(req.params.id);
    if (!owner) {
      return res.status(404).json({ message: "Restaurant not found!" });
    }
    owner.isOpen = !owner.isOpen;
    await owner.save();
    res.json({
      message: `Restaurant is now ${owner.isOpen ? "OPEN" : "CLOSED"}`,
      isOpen: owner.isOpen,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle status" });
  }
});

module.exports = router;
