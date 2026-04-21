const mongoose = require("mongoose");

const deliveryAgentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    mobile_no: { type: String, required: true },
    vehicleType: {
      type: String,
      enum: ["Bike", "Bicycle", "Scooter", "Car"],
      default: "Bike",
    },
    isAvailable: { type: Boolean, default: true },
    currentLocation: {
      lat: { type: Number, default: 0 },
      lng: { type: Number, default: 0 },
    },
    activeOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    totalDeliveries: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    rating: { type: Number, default: 5.0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DeliveryAgent", deliveryAgentSchema);
