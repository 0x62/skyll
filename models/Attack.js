var mongoose = require('mongoose');

var attackSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  country: String, // je/gg
  accuracy: Number,
  id: String,
  
  defence: {
    attemptBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    success: Boolean
  },
  
  success: Boolean
  
}, { timestamps: true });

var Attack = mongoose.model('Attack', attackSchema);

module.exports = Attack;
