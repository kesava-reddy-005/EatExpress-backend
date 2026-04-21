const express = require("express");
const router = express.Router();
const ChatMessage = require("../models/chat_model");
const { verifyToken } = require("../middleware/auth");

/* ============== GET ALL MESSAGES FOR AN ORDER ============== */
router.get("/:orderId", verifyToken, async (req, res) => {
  try {
    const messages = await ChatMessage.find({ orderId: req.params.orderId })
      .sort({ timestamp: 1 })
      .lean();
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch chat messages" });
  }
});

/* ============== GET MESSAGES BY CHANNEL ============== */
router.get("/:orderId/:channel", verifyToken, async (req, res) => {
  try {
    const { orderId, channel } = req.params;
    if (!["user-agent", "user-owner"].includes(channel)) {
      return res.status(400).json({ message: "Invalid channel" });
    }

    const messages = await ChatMessage.find({ orderId, channel })
      .sort({ timestamp: 1 })
      .lean();
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch chat messages" });
  }
});

module.exports = router;
