const mongoose = require("mongoose");

const ownerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  restaurantName: { type: String, required: true },
  mobile_no: { type: String, required: true },
  adders:{type:String,required:true},
});

module.exports = mongoose.model("Owner", ownerSchema);
