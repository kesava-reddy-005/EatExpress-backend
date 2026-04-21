const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const Admin = require("../models/admin_model");
const User = require("../models/user_model");
const Owner = require("../models/owner_model");
const Order = require("../models/order_model");
const DeliveryAgent = require("../models/delivery_agent_model");
const { generateToken, verifyToken, requireRole } = require("../middleware/auth");

/* ---------- ADMIN LOGIN ---------- */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(400).json({ message: "Admin not found" });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = generateToken({
      id: admin._id,
      email: admin.email,
      role: "admin",
    });

    res.json({
      message: "Admin login successful",
      token,
      admin: { id: admin._id, email: admin.email, name: admin.name, role: "admin" },
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------- SEED DEFAULT ADMIN ---------- */
router.post("/seed", async (req, res) => {
  try {
    const existing = await Admin.findOne({ email: "admin@eatexpress.com" });
    if (existing) return res.json({ message: "Admin already exists" });

    const hashed = await bcrypt.hash("admin123", 10);
    const admin = new Admin({
      name: "Super Admin",
      email: "admin@eatexpress.com",
      password: hashed,
      role: "admin",
    });
    await admin.save();
    res.json({ message: "Default admin created! Email: admin@eatexpress.com, Password: admin123" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------- GET ALL USERS ---------- */
router.get("/users", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

/* ---------- GET ALL OWNERS ---------- */
router.get("/owners", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const owners = await Owner.find().select("-password -menu").sort({ createdAt: -1 });
    res.json(owners);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch owners" });
  }
});

/* ---------- GET ALL ORDERS ---------- */
router.get("/orders", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

/* ---------- DELETE USER ---------- */
router.delete("/user/:id", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

/* ---------- DELETE OWNER ---------- */
router.delete("/owner/:id", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    await Owner.findByIdAndDelete(req.params.id);
    res.json({ message: "Restaurant deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete restaurant" });
  }
});

/* ---------- UPDATE ORDER STATUS (ADMIN) ---------- */
router.put("/order/:id/status", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "Order status updated", order });
  } catch (err) {
    res.status(500).json({ error: "Failed to update order" });
  }
});

/* ---------- GET ALL DELIVERY AGENTS ---------- */
router.get("/agents", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const agents = await DeliveryAgent.find().select("-password").sort({ createdAt: -1 });
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch agents" });
  }
});

/* ---------- DELETE DELIVERY AGENT ---------- */
router.delete("/agent/:id", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    await DeliveryAgent.findByIdAndDelete(req.params.id);
    res.json({ message: "Delivery agent deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete agent" });
  }
});

/* ---------- PLATFORM STATS ---------- */
router.get("/stats", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalOwners = await Owner.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalAgents = await DeliveryAgent.countDocuments();
    const deliveredOrders = await Order.find({ status: "Delivered" });
    const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    res.json({ totalUsers, totalOwners, totalOrders, totalAgents, totalRevenue: Math.round(totalRevenue) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

module.exports = router;
