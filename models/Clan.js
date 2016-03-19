var mongoose = require('mongoose');

var clanSchema = new mongoose.Schema({
  member: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // creator of clan
  
  name: String,
  description: String,
  
  public: Boolean // who can join
}, { timestamps: true });

var Clan = mongoose.model('Clan', clanSchema);

module.exports = Clan;
