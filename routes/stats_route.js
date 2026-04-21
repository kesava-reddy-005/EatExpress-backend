const express = require("express");
const router = express.Router();
const Order = require("../models/order_model");
const { verifyToken } = require("../middleware/auth");

/* ---------- REVENUE DATA (daily/weekly) ---------- */
router.get("/:ownerId/revenue", verifyToken, async (req, res) => {
  try {
    const { ownerId } = req.params;
    const { period } = req.query; // 'daily' or 'weekly'

    const now = new Date();
    let startDate;

    if (period === "weekly") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const orders = await Order.find({
      restaurantId: ownerId,
      status: "Delivered",
      createdAt: { $gte: startDate },
    }).sort({ createdAt: 1 });

    // Group by date
    const revenueByDate = {};
    orders.forEach((order) => {
      const dateKey = new Date(order.createdAt).toISOString().split("T")[0];
      if (!revenueByDate[dateKey]) {
        revenueByDate[dateKey] = 0;
      }
      revenueByDate[dateKey] += order.totalAmount || 0;
    });

    res.json({
      labels: Object.keys(revenueByDate),
      data: Object.values(revenueByDate),
      totalRevenue: Object.values(revenueByDate).reduce((a, b) => a + b, 0),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch revenue data" });
  }
});

/* ---------- TOP SELLING ITEMS ---------- */
router.get("/:ownerId/top-items", verifyToken, async (req, res) => {
  try {
    const { ownerId } = req.params;

    const orders = await Order.find({
      restaurantId: ownerId,
      status: "Delivered",
    });

    const itemCounts = {};
    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (!itemCounts[item.name]) {
          itemCounts[item.name] = 0;
        }
        itemCounts[item.name] += item.quantity || 1;
      });
    });

    const sorted = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    res.json({
      labels: sorted.map(([name]) => name),
      data: sorted.map(([, count]) => count),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch top items" });
  }
});

/* ---------- ORDER SUMMARY ---------- */
router.get("/:ownerId/summary", verifyToken, async (req, res) => {
  try {
    const { ownerId } = req.params;

    const total = await Order.countDocuments({ restaurantId: ownerId });
    const pending = await Order.countDocuments({ restaurantId: ownerId, status: "Pending" });
    const confirmed = await Order.countDocuments({ restaurantId: ownerId, status: "Confirmed" });
    const preparing = await Order.countDocuments({ restaurantId: ownerId, status: "Preparing" });
    const delivered = await Order.countDocuments({ restaurantId: ownerId, status: "Delivered" });
    const cancelled = await Order.countDocuments({ restaurantId: ownerId, status: "Cancelled" });

    const deliveredOrders = await Order.find({
      restaurantId: ownerId,
      status: "Delivered",
    });
    const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    res.json({
      total,
      pending,
      confirmed,
      preparing,
      delivered,
      cancelled,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

module.exports = router;
