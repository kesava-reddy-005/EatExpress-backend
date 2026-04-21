const express = require("express");
const router = express.Router();
const Owner = require("../models/owner_model");

/* ---------- GET MENU ---------- */
router.get("/:restaurantId", async (req, res) => {
  const owner = await Owner.findById(req.params.restaurantId);
  if (!owner) return res.status(404).json({ message: "Restaurant not found" });

  res.json(owner.menu);
});

/* ---------- ADD MENU ITEM ---------- */
router.post("/:restaurantId", async (req, res) => {
  const owner = await Owner.findById(req.params.restaurantId);
  if (!owner) return res.status(404).json({ message: "Restaurant not found" });

  owner.menu.push(req.body);
  await owner.save();

  res.json({ message: "Menu item added" });
});

/* ---------- UPDATE MENU ITEM ---------- */
router.put("/:restaurantId/:itemId", async (req, res) => {
  const owner = await Owner.findById(req.params.restaurantId);
  const item = owner.menu.find(i => i.id === req.params.itemId);

  if (!item) return res.status(404).json({ message: "Item not found" });

  Object.assign(item, req.body);
  await owner.save();

  res.json({ message: "Menu item updated" });
});

/* ---------- DELETE MENU ITEM ---------- */
router.delete("/:restaurantId/:itemId", async (req, res) => {
  const owner = await Owner.findById(req.params.restaurantId);
  owner.menu = owner.menu.filter(i => i.id !== req.params.itemId);
  await owner.save();

  res.json({ message: "Menu item deleted" });
});

module.exports = router;
