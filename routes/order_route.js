const express = require("express");
const Order = require("../models/order_model");
const Restaurant = require("../models/owner_model");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");

// ✅ POST — Create new order with billing + OTP
router.post("/", verifyToken, async (req, res) => {
  try {
    const { restaurantId, items, address, userId, userLocation } = req.body;

    // Calculate billing
    let subtotal = 0;
    const billedItems = items.map((item) => {
      const qty = item.quantity || 1;
      subtotal += item.price * qty;
      return { ...item, quantity: qty };
    });

    const tax = Math.round(subtotal * 0.05 * 100) / 100; // 5% tax
    const deliveryFee = 30;
    const totalAmount = Math.round((subtotal + tax + deliveryFee) * 100) / 100;

    // Estimated delivery: 30-45 min
    const minMinutes = 30;
    const maxMinutes = 45;
    const randomMin = Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
    const estimatedDeliveryTime = new Date(Date.now() + randomMin * 60000);

    // Get restaurant details (name + location)
    const restaurant = await Restaurant.findById(restaurantId);

    // Generate 4-digit OTP for delivery verification
    const deliveryOtp = String(Math.floor(1000 + Math.random() * 9000));

    const newOrder = new Order({
      restaurantId,
      restaurantName: restaurant ? restaurant.restaurantName : "",
      items: billedItems,
      address,
      userId,
      date: new Date(),
      subtotal,
      tax,
      deliveryFee,
      totalAmount,
      estimatedDeliveryTime,
      deliveryOtp,
      userLocation: userLocation || { lat: 0, lng: 0 },
      restaurantLocation: restaurant && restaurant.location
        ? { lat: restaurant.location.lat, lng: restaurant.location.lng }
        : { lat: 0, lng: 0 },
    });

    await newOrder.save();

    // Emit socket event for new order
    const io = req.app.get("io");
    if (io) {
      io.to(`owner_${restaurantId}`).emit("newOrder", newOrder);
    }

    // Twilio SMS (optional, keep for new orders only)
    try {
      if (restaurant && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        const twilio = require("twilio");
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        const messageBody = `🍽️ New Order Alert!\nRestaurant: ${restaurant.restaurantName}\nItems: ${billedItems.map((i) => `${i.name} x${i.quantity}`).join(", ")}\nTotal: ₹${totalAmount}\nAddress: ${address}`;
        await client.messages.create({
          body: messageBody,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: `+91${restaurant.mobile_no}`,
        });
      }
    } catch (smsErr) {
      console.warn("SMS send failed (non-critical):", smsErr.message);
    }

    res.status(201).json({ message: "Order placed successfully!", order: newOrder });
  } catch (err) {
    console.error("Error saving order:", err);
    res.status(500).json({ error: "Failed to save order" });
  }
});

// ✅ GET — Fetch all orders
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// ✅ GET — Fetch orders by userId
router.get("/user/:userId", verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await Order.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// ✅ GET — Fetch orders by restaurantId
router.get("/restaurant/:restaurantId", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const orders = await Order.find({ restaurantId }).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// ✅ PUT — Update order status (Owner)
router.put("/:id/status", verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["Confirmed", "Preparing", "Ready", "Delivered"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status === "Cancelled") {
      return res.status(400).json({ message: "Cannot update a cancelled order" });
    }

    order.status = status;
    if (status === "Ready") {
      order.foodReadyAt = new Date();
    }
    await order.save();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${order.userId}`).emit("orderStatusUpdate", {
        orderId: order._id,
        status: order.status,
      });
      io.to(`order_${order._id}`).emit("orderStatusUpdate", {
        orderId: order._id,
        status: order.status,
      });

      // When order is "Ready", notify available delivery agents
      if (status === "Ready") {
        io.to("agents_available").emit("orderReadyForPickup", {
          orderId: order._id,
          restaurantName: order.restaurantName,
          address: order.address,
          totalAmount: order.totalAmount,
          items: order.items,
        });
      }
    }

    res.json({ message: `Order status updated to ${status}`, order });
  } catch (err) {
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// ✅ GET — Order tracking data (for live map)
router.get("/:id/tracking", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    res.json({
      orderId: order._id,
      status: order.status,
      deliveryAgentName: order.deliveryAgentName,
      deliveryLocation: order.deliveryLocation,
      restaurantLocation: order.restaurantLocation,
      userLocation: order.userLocation,
      estimatedDeliveryTime: order.estimatedDeliveryTime,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tracking data" });
  }
});

// ✅ GET — Food freshness data (for delivered orders)
router.get("/:id/freshness", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status !== "Delivered") {
      return res.status(400).json({ message: "Freshness data available only for delivered orders" });
    }

    if (!order.foodReadyAt || !order.deliveredAt) {
      return res.json({
        orderId: order._id,
        foodReadyAt: order.foodReadyAt || null,
        deliveredAt: order.deliveredAt || null,
        durationMinutes: null,
        freshnessRating: "N/A",
      });
    }

    const durationMs = new Date(order.deliveredAt) - new Date(order.foodReadyAt);
    const durationMinutes = Math.round(durationMs / 60000);

    let freshnessRating;
    if (durationMinutes <= 15) freshnessRating = "Ultra Fresh";
    else if (durationMinutes <= 30) freshnessRating = "Fresh";
    else if (durationMinutes <= 45) freshnessRating = "Moderate";
    else freshnessRating = "Stale Risk";

    res.json({
      orderId: order._id,
      foodReadyAt: order.foodReadyAt,
      deliveredAt: order.deliveredAt,
      durationMinutes,
      freshnessRating,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch freshness data" });
  }
});

// ✅ PUT — Cancel order (User, within 5 min)
router.put("/:id/cancel", verifyToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status !== "Pending") {
      return res.status(400).json({ message: "Only pending orders can be cancelled" });
    }

    // Check 5-minute window
    const orderTime = new Date(order.createdAt).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (now - orderTime > fiveMinutes) {
      return res.status(400).json({ message: "Cancellation window (5 minutes) has passed" });
    }

    order.status = "Cancelled";
    order.cancelledAt = new Date();
    await order.save();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.to(`owner_${order.restaurantId}`).emit("orderCancelled", {
        orderId: order._id,
      });
    }

    res.json({ message: "Order cancelled successfully", order });
  } catch (err) {
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

module.exports = router;
