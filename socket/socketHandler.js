/* ---------- SOCKET.IO HANDLER ---------- */
const ChatMessage = require("../models/chat_model");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("🔌 Socket connected:", socket.id);

    /* User joins a room for their userId to receive order updates */
    socket.on("joinUserRoom", (userId) => {
      socket.join(`user_${userId}`);
      console.log(`👤 User ${userId} joined room user_${userId}`);
    });

    /* Owner joins a room for their restaurantId */
    socket.on("joinOwnerRoom", (ownerId) => {
      socket.join(`owner_${ownerId}`);
      console.log(`🏪 Owner ${ownerId} joined room owner_${ownerId}`);
    });

    /* Join a specific order room */
    socket.on("joinOrderRoom", (orderId) => {
      socket.join(`order_${orderId}`);
      console.log(`📦 Joined order room order_${orderId}`);
    });

    /* -------- Chat Events -------- */

    /* Join a chat room for an order */
    socket.on("joinChatRoom", (orderId) => {
      socket.join(`chat_${orderId}`);
      console.log(`💬 Joined chat room chat_${orderId}`);
    });

    /* Leave a chat room */
    socket.on("leaveChatRoom", (orderId) => {
      socket.leave(`chat_${orderId}`);
      console.log(`💬 Left chat room chat_${orderId}`);
    });

    /* Send a chat message — persist to DB and broadcast */
    socket.on("sendMessage", async (data) => {
      // data: { orderId, senderId, senderRole, senderName, receiverRole, message }
      try {
        const { orderId, senderId, senderRole, senderName, receiverRole, message } = data;
        if (!orderId || !senderId || !senderRole || !message) return;

        // Determine channel
        const roles = [senderRole, receiverRole].sort();
        let channel;
        if (roles.includes("delivery_agent") && roles.includes("user")) {
          channel = "user-agent";
        } else {
          channel = "user-owner";
        }

        const chatMsg = new ChatMessage({
          orderId,
          senderId,
          senderRole,
          senderName,
          receiverRole,
          channel,
          message,
          timestamp: new Date(),
        });

        await chatMsg.save();

        // Broadcast to the chat room
        io.to(`chat_${orderId}`).emit("chatMessage", {
          _id: chatMsg._id,
          orderId,
          senderId,
          senderRole,
          senderName,
          receiverRole,
          channel,
          message,
          timestamp: chatMsg.timestamp,
        });
      } catch (err) {
        console.error("Chat message error:", err.message);
      }
    });

    /* -------- Delivery Agent Events -------- */

    /* Agent joins their personal room + the available agents pool */
    socket.on("joinAgentRoom", (agentId) => {
      socket.join(`agent_${agentId}`);
      socket.join("agents_available");
      console.log(`🛵 Agent ${agentId} joined rooms`);
    });

    /* Agent leaves the available pool (when on delivery or offline) */
    socket.on("leaveAgentPool", () => {
      socket.leave("agents_available");
      console.log(`🛵 Agent left available pool`);
    });

    /* Agent rejoins the available pool (after delivery complete) */
    socket.on("rejoinAgentPool", () => {
      socket.join("agents_available");
      console.log(`🛵 Agent rejoined available pool`);
    });

    /* Agent broadcasts their GPS location */
    socket.on("updateLocation", (data) => {
      // data: { orderId, lat, lng, agentName }
      if (data.orderId) {
        // Broadcast to users tracking this order
        io.to(`order_${data.orderId}`).emit("liveLocation", {
          orderId: data.orderId,
          lat: data.lat,
          lng: data.lng,
          agentName: data.agentName,
        });
      }
    });

    /* User broadcasts their GPS location for delivery tracking */
    socket.on("updateUserLocation", (data) => {
      // data: { orderId, lat, lng }
      if (data.orderId) {
        io.to(`order_${data.orderId}`).emit("liveUserLocation", {
          orderId: data.orderId,
          lat: data.lat,
          lng: data.lng,
        });
      }
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected:", socket.id);
    });
  });
};

