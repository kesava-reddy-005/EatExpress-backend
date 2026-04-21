const express = require("express");
const router = express.Router();
const Review = require("../models/review_model");
const Order = require("../models/order_model");
const Owner = require("../models/owner_model");
const { verifyToken } = require("../middleware/auth");

/* ---------- POST REVIEW (after delivery only) ---------- */
router.post("/", verifyToken, async (req, res) => {
  try {
    const { orderId, restaurantId, rating, comment } = req.body;

    // Check order exists and is delivered
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status !== "Delivered") {
      return res.status(400).json({ message: "Can only review delivered orders" });
    }
    if (order.isReviewed) {
      return res.status(400).json({ message: "Order already reviewed" });
    }

    const review = new Review({
      userId: req.user.id,
      userName: req.body.userName || "Anonymous",
      restaurantId,
      orderId,
      rating,
      comment,
    });

    await review.save();

    // Mark order as reviewed
    order.isReviewed = true;
    await order.save();

    // Update restaurant average rating
    const allReviews = await Review.find({ restaurantId });
    const avgRating =
      allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

    await Owner.findByIdAndUpdate(restaurantId, {
      avgRating: Math.round(avgRating * 10) / 10,
      totalReviews: allReviews.length,
    });

    res.status(201).json({ message: "Review submitted!", review });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Already reviewed this order" });
    }
    res.status(500).json({ error: err.message });
  }
});

/* ---------- GET REVIEWS FOR A RESTAURANT ---------- */
router.get("/:restaurantId", async (req, res) => {
  try {
    const reviews = await Review.find({
      restaurantId: req.params.restaurantId,
    }).sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

module.exports = router;
