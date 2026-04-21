const express = require("express");
require("dotenv").config();
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const userRouter = require("./routes/user_route.js");
const ownerRouter = require("./routes/owner_route.js");
const orderRouter = require("./routes/order_route.js");
const menurouter = require("./routes/menu_routes.js");
const reviewRouter = require("./routes/review_route.js");
const statsRouter = require("./routes/stats_route.js");
const adminRouter = require("./routes/admin_route.js");
const deliveryRouter = require("./routes/delivery_route.js");
const chatRouter = require("./routes/chat_route.js");
const invoiceRouter = require("./routes/invoice_route.js");
const socketHandler = require("./socket/socketHandler.js");

const app = express();
const server = http.createServer(app);

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// Make io accessible in routes
app.set("io", io);

// Initialize socket handler
socketHandler(io);

app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// Routers
app.use("/user", userRouter);
app.use("/owner", ownerRouter);
app.use("/order", orderRouter);
app.use("/menu", menurouter);
app.use("/review", reviewRouter);
app.use("/stats", statsRouter);
app.use("/admin", adminRouter);
app.use("/delivery", deliveryRouter);
app.use("/chat", chatRouter);
app.use("/invoice", invoiceRouter);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
