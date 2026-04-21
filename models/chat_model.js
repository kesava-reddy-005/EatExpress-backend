const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Order",
      index: true,
    },
    senderId: {
      type: String,
      required: true,
    },
    senderRole: {
      type: String,
      required: true,
      enum: ["user", "owner", "delivery_agent"],
    },
    senderName: {
      type: String,
      required: true,
    },
    receiverRole: {
      type: String,
      required: true,
      enum: ["user", "owner", "delivery_agent"],
    },
    /* Channel: "user-agent" or "user-owner" */
    channel: {
      type: String,
      required: true,
      enum: ["user-agent", "user-owner"],
    },
    message: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

/* Compound index for efficient fetching */
chatMessageSchema.index({ orderId: 1, channel: 1, timestamp: 1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
