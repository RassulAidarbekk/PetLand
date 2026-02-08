const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
  upper: String, 
  face: String,
  down: String,
  color: String, 
  owner: String, 
  forSale: { type: Boolean, default: false },
  price: { type: Number, default: 0 },
  image: String 
});

module.exports = mongoose.model('Pet', petSchema);