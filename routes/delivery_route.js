const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const DeliveryAgent = require("../models/delivery_agent_model");
const Order = require("../models/order_model");
const { generateToken, verifyToken, requireRole } = require("../middleware/auth");

/* ============== REGISTER ============== */
router.post("/register", async (req, res) => {
  try {
    const { password, ...rest } = req.body;

    const existing = await DeliveryAgent.findOne({ email: rest.email });
    if (existing) {
      return res.status(400).json({ message: "Agent already registered!" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const agent = new DeliveryAgent({
      ...rest,
      password: hashedPassword,
    });

    await agent.save();

    const token = generateToken({
      id: agent._id,
      email: agent.email,
      role: "delivery_agent",
    });

    res.json({ message: "Delivery agent registered!", token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/* ============== LOGIN ============== */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const agent = await DeliveryAgent.findOne({ email });
    if (!agent) return res.status(400).json({ message: "Agent not found" });

    const isMatch = await bcrypt.compare(password, agent.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = generateToken({
      id: agent._id,
      email: agent.email,
      role: "delivery_agent",
    });

    res.json({
      message: "Login successful!",
      token,
      agent: {
        id: agent._id,
        email: agent.email,
        name: agent.name,
        mobile_no: agent.mobile_no,
        vehicleType: agent.vehicleType,
        isAvailable: agent.isAvailable,
        totalDeliveries: agent.totalDeliveries,
        totalEarnings: agent.totalEarnings,
        rating: agent.rating,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ============== GET PROFILE ============== */
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const agent = await DeliveryAgent.findById(req.user.id).select("-password");
    if (!agent) return res.status(404).json({ message: "Agent not found" });
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ============== TOGGLE AVAILABILITY ============== */
router.put("/toggle-availability", verifyToken, async (req, res) => {
  try {
    const agent = await DeliveryAgent.findById(req.user.id);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    // Can't go unavailable while on active delivery
    if (agent.activeOrderId) {
      return res.status(400).json({ message: "Complete current delivery first" });
    }

    agent.isAvailable = !agent.isAvailable;
    await agent.save();

    res.json({
      message: `Now ${agent.isAvailable ? "Available" : "Unavailable"}`,
      isAvailable: agent.isAvailable,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to toggle availability" });
  }
});

/* ============== AVAILABLE ORDERS (status: "Ready") ============== */
router.get("/available-orders", verifyToken, async (req, res) => {
  try {
    const orders = await Order.find({
      status: "Ready",
      deliveryAgentId: null,
    }).sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch available orders" });
  }
});

/* ============== ACCEPT DELIVERY ============== */
router.put("/accept/:orderId", verifyToken, async (req, res) => {
  try {
    const agent = await DeliveryAgent.findById(req.user.id);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    if (agent.activeOrderId) {
      return res.status(400).json({ message: "You already have an active delivery" });
    }

    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status !== "Ready") {
      return res.status(400).json({ message: "Order is not ready for pickup" });
    }

    if (order.deliveryAgentId) {
      return res.status(400).json({ message: "Order already assigned" });
    }

    // Assign agent to order
    order.deliveryAgentId = agent._id;
    order.deliveryAgentName = agent.name;
    order.status = "Picked Up";
    order.pickedUpAt = new Date();
    await order.save();

    // Update agent
    agent.activeOrderId = order._id;
    agent.isAvailable = false;
    await agent.save();

    // Emit socket events
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${order.userId}`).emit("orderStatusUpdate", {
        orderId: order._id,
        status: order.status,
        deliveryAgentName: agent.name,
      });
      io.to(`owner_${order.restaurantId}`).emit("deliveryAccepted", {
        orderId: order._id,
        agentName: agent.name,
      });
      // Remove from available orders for other agents
      io.to("agents_available").emit("orderTaken", { orderId: order._id });
    }

    res.json({ message: "Delivery accepted!", order });
  } catch (err) {
    res.status(500).json({ error: "Failed to accept delivery" });
  }
});

/* ============== UPDATE LOCATION (live GPS) ============== */
router.put("/location", verifyToken, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const agent = await DeliveryAgent.findById(req.user.id);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    agent.currentLocation = { lat, lng };
    await agent.save();

    // If agent has active order, update the order's deliveryLocation too
    if (agent.activeOrderId) {
      await Order.findByIdAndUpdate(agent.activeOrderId, {
        deliveryLocation: { lat, lng },
      });

      // Broadcast to user and order rooms
      const order = await Order.findById(agent.activeOrderId);
      const io = req.app.get("io");
      if (io && order) {
        io.to(`user_${order.userId}`).emit("liveLocation", {
          orderId: order._id,
          lat,
          lng,
          agentName: agent.name,
        });
        io.to(`order_${order._id}`).emit("liveLocation", {
          orderId: order._id,
          lat,
          lng,
          agentName: agent.name,
        });
      }
    }

    res.json({ message: "Location updated", location: { lat, lng } });
  } catch (err) {
    res.status(500).json({ error: "Failed to update location" });
  }
});

/* ============== MARK OUT FOR DELIVERY ============== */
router.put("/out-for-delivery/:orderId", verifyToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (String(order.deliveryAgentId) !== req.user.id) {
      return res.status(403).json({ message: "Not your delivery" });
    }

    if (order.status !== "Picked Up") {
      return res.status(400).json({ message: "Order must be in 'Picked Up' status" });
    }

    order.status = "Out for Delivery";
    await order.save();

    const io = req.app.get("io");
    if (io) {
      io.to(`user_${order.userId}`).emit("orderStatusUpdate", {
        orderId: order._id,
        status: order.status,
      });
    }

    res.json({ message: "Out for delivery!", order });
  } catch (err) {
    res.status(500).json({ error: "Failed to update status" });
  }
});

/* ============== MARK DELIVERED (requires OTP) ============== */
router.put("/deliver/:orderId", verifyToken, async (req, res) => {
  try {
    const { otp } = req.body;
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (String(order.deliveryAgentId) !== req.user.id) {
      return res.status(403).json({ message: "Not your delivery" });
    }

    if (order.status !== "Out for Delivery" && order.status !== "Picked Up") {
      return res.status(400).json({ message: "Invalid order status for delivery" });
    }

    // Verify OTP
    if (!otp) {
      return res.status(400).json({ message: "OTP is required to complete delivery" });
    }
    if (String(otp) !== String(order.deliveryOtp)) {
      return res.status(400).json({ message: "Invalid OTP. Please check with the customer." });
    }

    order.status = "Delivered";
    order.deliveredAt = new Date();
    order.otpVerified = true;
    await order.save();

    // Update agent stats
    const agent = await DeliveryAgent.findById(req.user.id);
    agent.activeOrderId = null;
    agent.isAvailable = true;
    agent.totalDeliveries += 1;
    agent.totalEarnings += order.deliveryFee || 30;
    await agent.save();

    // Emit socket events
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${order.userId}`).emit("orderStatusUpdate", {
        orderId: order._id,
        status: "Delivered",
      });
      io.to(`owner_${order.restaurantId}`).emit("orderStatusUpdate", {
        orderId: order._id,
        status: "Delivered",
      });
    }

    // Calculate food freshness
    let freshness = null;
    if (order.foodReadyAt && order.deliveredAt) {
      const durationMs = new Date(order.deliveredAt) - new Date(order.foodReadyAt);
      const durationMinutes = Math.round(durationMs / 60000);
      let freshnessRating;
      if (durationMinutes <= 15) freshnessRating = "Ultra Fresh";
      else if (durationMinutes <= 30) freshnessRating = "Fresh";
      else if (durationMinutes <= 45) freshnessRating = "Moderate";
      else freshnessRating = "Stale Risk";
      freshness = { durationMinutes, freshnessRating };
    }

    res.json({ message: "Order delivered successfully! OTP verified ✅", order, freshness });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark delivered" });
  }
});

/* ============== MY DELIVERIES (history) ============== */
router.get("/my-deliveries", verifyToken, async (req, res) => {
  try {
    const orders = await Order.find({
      deliveryAgentId: req.user.id,
      status: "Delivered",
    }).sort({ deliveredAt: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch delivery history" });
  }
});

/* ============== EARNINGS DASHBOARD ============== */
router.get("/earnings", verifyToken, async (req, res) => {
  try {
    const agent = await DeliveryAgent.findById(req.user.id);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    // This week's earnings
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekOrders = await Order.find({
      deliveryAgentId: req.user.id,
      status: "Delivered",
      deliveredAt: { $gte: weekAgo },
    });
    const weeklyEarnings = weekOrders.reduce((sum, o) => sum + (o.deliveryFee || 30), 0);

    // Today's earnings
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayOrders = await Order.find({
      deliveryAgentId: req.user.id,
      status: "Delivered",
      deliveredAt: { $gte: todayStart },
    });
    const todayEarnings = todayOrders.reduce((sum, o) => sum + (o.deliveryFee || 30), 0);

    // Daily breakdown (last 7 days)
    const dailyBreakdown = {};
    weekOrders.forEach((o) => {
      const dateKey = new Date(o.deliveredAt).toISOString().split("T")[0];
      if (!dailyBreakdown[dateKey]) dailyBreakdown[dateKey] = 0;
      dailyBreakdown[dateKey] += o.deliveryFee || 30;
    });

    res.json({
      totalDeliveries: agent.totalDeliveries,
      totalEarnings: agent.totalEarnings,
      weeklyEarnings,
      weeklyDeliveries: weekOrders.length,
      todayEarnings,
      todayDeliveries: todayOrders.length,
      dailyBreakdown: {
        labels: Object.keys(dailyBreakdown),
        data: Object.values(dailyBreakdown),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch earnings" });
  }
});

/* ============== ACTIVE DELIVERY ============== */
router.get("/active", verifyToken, async (req, res) => {
  try {
    const agent = await DeliveryAgent.findById(req.user.id);
    if (!agent || !agent.activeOrderId) {
      return res.json({ activeOrder: null });
    }

    const order = await Order.findById(agent.activeOrderId);
    res.json({ activeOrder: order });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch active delivery" });
  }
});

module.exports = router;
