const mongoose = require("mongoose");

/* ---------- MENU SUB SCHEMA ---------- */
const menuSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  rating: { type: Number, default: 4.0 },
  img: { type: String, required: true },
  category: {
    type: String,
    enum: ["Veg", "Non-Veg", "Starters", "Mains", "Desserts", "Drinks"],
    default: "Mains",
  },
  isVeg: { type: Boolean, default: false },
});

/* ---------- OWNER SCHEMA ---------- */
const ownerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    restaurantName: { type: String, required: true },
    mobile_no: { type: String, required: true },
    adders: { type: String, required: true },
    isOpen: { type: Boolean, default: true },
    location: {
      lat: { type: Number, default: 12.9716 },
      lng: { type: Number, default: 77.5946 },
    },
    avgRating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    menu: {
      type: [menuSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Owner", ownerSchema);
