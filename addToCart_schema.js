var mongoose = require('mongoose');
var db = require('./db_init');
var a_schema = new mongoose.Schema({
    item_id:{type:mongoose.Types.ObjectId,ref:"items",required:true},
    quantity:{type:Number,required:true},
    special_i:{type:String},
    user_id:{type:mongoose.Types.ObjectId,ref:"users"},
    order_type:{type:String,enum:["delivery","pickup_only"],default:"delivery"},
    seller_id:{type:mongoose.Types.ObjectId,ref:"users"},
    date:{type:Date,default:Date.now}
})
module.exports = mongoose.model('addToCart',a_schema);