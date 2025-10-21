const express = require("express");
const Order = require("../models/order_model");
const Restaurant = require("../models/owner_model"); // ⬅️ Import restaurant model
const router = express.Router();
const twilio = require("twilio");
require("dotenv").config();

// ✅ Twilio setup (from your .env file)
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ✅ POST — Create new order + send SMS alert
router.post("/", async (req, res) => {
  try {
    const newOrder = new Order(req.body);
    await newOrder.save();

    // Fetch restaurant details using restaurantId
    const { restaurantId, items, address, date } = req.body;
    const restaurant = await Restaurant.findById(restaurantId);

    if (restaurant) {
      // Create SMS message content
      const messageBody = `🍽️ New Order Alert!
Restaurant: ${restaurant.restaurantName}
Items: ${items.map((i) => i.name).join(", ")}
Address: ${address}
Date: ${new Date(date).toLocaleString()}
Status: Pending`;

      // Send SMS to restaurant's mobile number
      await client.messages.create({
        body: messageBody,
        from: process.env.TWILIO_PHONE_NUMBER, // Twilio sender number
        to: `+91${restaurant.mobile_no}`, // assuming Indian numbers
      });

      console.log("✅ SMS sent to restaurant:", restaurant.mobile_no);
    } else {
      console.warn("⚠️ Restaurant not found for ID:", restaurantId);
    }

    res
      .status(201)
      .json({ message: "Order saved & alert sent successfully", order: newOrder });
  } catch (err) {
    console.error("Error saving order:", err);
    res.status(500).json({ error: "Failed to save order" });
  }
});

// ✅ GET — Fetch all orders
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find();
    res.status(200).json(orders);
  } catch (err) {
    console.error("Error fetching all orders:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// ✅ GET — Fetch orders by userId
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await Order.find({ userId });

    if (!orders.length) {
      return res.status(404).json({ message: "No orders found for this user" });
    }

    res.status(200).json(orders);
  } catch (err) {
    console.error("Error fetching user orders:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// ✅ GET — Fetch orders by restaurantId
router.get("/restaurant/:restaurantId", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const orders = await Order.find({ restaurantId });

    if (!orders.length) {
      return res
        .status(404)
        .json({ message: "No orders found for this restaurant" });
    }

    res.status(200).json(orders);
  } catch (err) {
    console.error("Error fetching restaurant orders:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

module.exports = router;
