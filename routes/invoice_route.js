const express = require("express");
const router = express.Router();
const PDFDocument = require("pdfkit");
const Order = require("../models/order_model");
const { verifyToken } = require("../middleware/auth");

/* ============== FRESHNESS HELPER ============== */
function getFreshnessInfo(foodReadyAt, deliveredAt) {
  if (!foodReadyAt || !deliveredAt) return null;
  const durationMs = new Date(deliveredAt) - new Date(foodReadyAt);
  const durationMinutes = Math.round(durationMs / 60000);

  let rating, label;
  if (durationMinutes <= 15) {
    rating = "Ultra Fresh";
    label = "🟢";
  } else if (durationMinutes <= 30) {
    rating = "Fresh";
    label = "🟡";
  } else if (durationMinutes <= 45) {
    rating = "Moderate";
    label = "🟠";
  } else {
    rating = "Stale Risk";
    label = "🔴";
  }

  return { durationMinutes, rating, label };
}

/* ============== GENERATE INVOICE PDF ============== */
router.get("/:orderId", verifyToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status !== "Delivered") {
      return res.status(400).json({ message: "Invoice available only for delivered orders" });
    }

    const doc = new PDFDocument({ size: "A4", margin: 50 });

    // Set response headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=EatExpress_Invoice_${order._id.toString().slice(-6)}.pdf`
    );

    doc.pipe(res);

    // ---- HEADER ----
    doc
      .fontSize(28)
      .font("Helvetica-Bold")
      .fillColor("#6366f1")
      .text("EatExpress", 50, 50);

    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#888")
      .text("Food Delivery Platform", 50, 82);

    doc
      .moveTo(50, 100)
      .lineTo(545, 100)
      .strokeColor("#e0e0e0")
      .lineWidth(1)
      .stroke();

    // ---- INVOICE TITLE ----
    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .fillColor("#222")
      .text("INVOICE", 50, 115);

    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#666");

    const infoStartY = 140;
    doc.text(`Invoice #: INV-${order._id.toString().slice(-8).toUpperCase()}`, 50, infoStartY);
    doc.text(`Order Date: ${new Date(order.date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`, 50, infoStartY + 16);
    doc.text(`Delivery Date: ${order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "N/A"}`, 50, infoStartY + 32);

    // Right side info
    doc.text(`Restaurant: ${order.restaurantName || "N/A"}`, 300, infoStartY);
    doc.text(`Delivery Address: ${order.address}`, 300, infoStartY + 16, { width: 245 });

    if (order.deliveryAgentName) {
      doc.text(`Delivery Agent: ${order.deliveryAgentName}`, 300, infoStartY + 44);
    }

    // ---- SEPARATOR ----
    doc
      .moveTo(50, infoStartY + 65)
      .lineTo(545, infoStartY + 65)
      .strokeColor("#e0e0e0")
      .lineWidth(1)
      .stroke();

    // ---- ITEMS TABLE ----
    let tableY = infoStartY + 80;

    // Table header
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor("#6366f1");

    doc.text("#", 50, tableY, { width: 30 });
    doc.text("Item", 80, tableY, { width: 220 });
    doc.text("Qty", 300, tableY, { width: 50, align: "center" });
    doc.text("Price", 360, tableY, { width: 80, align: "right" });
    doc.text("Total", 460, tableY, { width: 85, align: "right" });

    tableY += 18;
    doc
      .moveTo(50, tableY)
      .lineTo(545, tableY)
      .strokeColor("#ddd")
      .lineWidth(0.5)
      .stroke();
    tableY += 8;

    // Table rows
    doc.font("Helvetica").fillColor("#333").fontSize(10);

    order.items.forEach((item, index) => {
      const qty = item.quantity || 1;
      const lineTotal = item.price * qty;

      // Alternate row background
      if (index % 2 === 0) {
        doc.rect(50, tableY - 3, 495, 18).fill("#f8f8ff").fillColor("#333");
      }

      doc.text(`${index + 1}`, 50, tableY, { width: 30 });
      doc.text(item.name, 80, tableY, { width: 220 });
      doc.text(`${qty}`, 300, tableY, { width: 50, align: "center" });
      doc.text(`Rs.${item.price.toFixed(2)}`, 360, tableY, { width: 80, align: "right" });
      doc.text(`Rs.${lineTotal.toFixed(2)}`, 460, tableY, { width: 85, align: "right" });

      tableY += 20;
    });

    // ---- TOTALS ----
    tableY += 5;
    doc
      .moveTo(350, tableY)
      .lineTo(545, tableY)
      .strokeColor("#ddd")
      .lineWidth(0.5)
      .stroke();
    tableY += 10;

    doc.font("Helvetica").fontSize(10).fillColor("#666");
    doc.text("Subtotal:", 360, tableY, { width: 80, align: "right" });
    doc.text(`Rs.${(order.subtotal || 0).toFixed(2)}`, 460, tableY, { width: 85, align: "right" });
    tableY += 18;

    doc.text("Tax (5%):", 360, tableY, { width: 80, align: "right" });
    doc.text(`Rs.${(order.tax || 0).toFixed(2)}`, 460, tableY, { width: 85, align: "right" });
    tableY += 18;

    doc.text("Delivery Fee:", 360, tableY, { width: 80, align: "right" });
    doc.text(`Rs.${(order.deliveryFee || 30).toFixed(2)}`, 460, tableY, { width: 85, align: "right" });
    tableY += 5;

    doc
      .moveTo(350, tableY + 8)
      .lineTo(545, tableY + 8)
      .strokeColor("#6366f1")
      .lineWidth(1.5)
      .stroke();
    tableY += 18;

    doc.font("Helvetica-Bold").fontSize(13).fillColor("#6366f1");
    doc.text("Total:", 360, tableY, { width: 80, align: "right" });
    doc.text(`Rs.${(order.totalAmount || 0).toFixed(2)}`, 460, tableY, { width: 85, align: "right" });

    // ---- FOOD FRESHNESS ----
    tableY += 35;
    const freshness = getFreshnessInfo(order.foodReadyAt, order.deliveredAt);
    if (freshness) {
      doc
        .moveTo(50, tableY)
        .lineTo(545, tableY)
        .strokeColor("#e0e0e0")
        .lineWidth(0.5)
        .stroke();
      tableY += 12;

      doc.font("Helvetica-Bold").fontSize(12).fillColor("#222");
      doc.text("Food Freshness Report", 50, tableY);
      tableY += 20;

      doc.font("Helvetica").fontSize(10).fillColor("#666");
      doc.text(`Food Prepared At: ${new Date(order.foodReadyAt).toLocaleTimeString("en-IN")}`, 50, tableY);
      tableY += 16;
      doc.text(`Delivered At: ${new Date(order.deliveredAt).toLocaleTimeString("en-IN")}`, 50, tableY);
      tableY += 16;
      doc.text(`Duration: ${freshness.durationMinutes} minutes`, 50, tableY);
      tableY += 16;

      // Freshness rating with color
      const ratingColors = {
        "Ultra Fresh": "#22c55e",
        "Fresh": "#eab308",
        "Moderate": "#f97316",
        "Stale Risk": "#ef4444",
      };
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(ratingColors[freshness.rating] || "#666");
      doc.text(`Freshness Rating: ${freshness.rating}`, 50, tableY);
    }

    // ---- VERIFICATION STATUS ----
    tableY += 30;
    doc
      .moveTo(50, tableY)
      .lineTo(545, tableY)
      .strokeColor("#e0e0e0")
      .lineWidth(0.5)
      .stroke();
    tableY += 12;

    doc.font("Helvetica").fontSize(10).fillColor("#22c55e");
    doc.text("✓ OTP Verified Delivery", 50, tableY);

    // ---- FOOTER ----
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#aaa")
      .text(
        "Thank you for ordering with EatExpress! This is a computer-generated invoice.",
        50,
        750,
        { align: "center", width: 495 }
      );

    doc.end();
  } catch (err) {
    console.error("Invoice generation error:", err);
    res.status(500).json({ error: "Failed to generate invoice" });
  }
});

module.exports = router;
