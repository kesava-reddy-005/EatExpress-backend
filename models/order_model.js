const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: String,
      required: true,
    },
    restaurantName: { type: String, default: "" },
    items: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, default: 1 },
        rating: { type: Number, default: 0 },
        img: { type: String },
      },
    ],
    address: { type: String, required: true },
    date: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "Preparing",
        "Ready",
        "Picked Up",
        "Out for Delivery",
        "Delivered",
        "Cancelled",
      ],
      default: "Pending",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },

    /* -------- Delivery Agent Fields -------- */
    deliveryAgentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryAgent",
      default: null,
    },
    deliveryAgentName: { type: String, default: "" },

    /* -------- Location Fields (for map tracking) -------- */
    deliveryLocation: {
      lat: { type: Number, default: 0 },
      lng: { type: Number, default: 0 },
    },
    restaurantLocation: {
      lat: { type: Number, default: 0 },
      lng: { type: Number, default: 0 },
    },
    userLocation: {
      lat: { type: Number, default: 0 },
      lng: { type: Number, default: 0 },
    },

    /* -------- Billing -------- */
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 30 },
    totalAmount: { type: Number, default: 0 },
    estimatedDeliveryTime: { type: Date },

    /* -------- OTP Verification -------- */
    deliveryOtp: { type: String, default: "" },
    otpVerified: { type: Boolean, default: false },

    /* -------- Timestamps -------- */
    cancelledAt: { type: Date },
    pickedUpAt: { type: Date },
    deliveredAt: { type: Date },
    foodReadyAt: { type: Date },
    isReviewed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
