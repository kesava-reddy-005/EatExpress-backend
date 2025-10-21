const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: String,
      required: true,
    },
    items: [
      {
        id: { type: String, required: true },       // e.g., "biryani_special"
        name: { type: String, required: true },
        price: { type: Number, required: true },
        rating: { type: Number, default: 0 },
        img: { type: String },
      },
    ],
    address: { type: String, required: true },
    date: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Delivered", "Cancelled"],
      default: "Pending",
    },

    // ✅ User info
    userId: {
      type: mongoose.Schema.Types.ObjectId, // store ObjectId of user
      required: true,
      ref: "User",
    },

  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
