var mongoose = require('mongoose');
var db = require('./db_init');
var o_schema = new mongoose.Schema({
    item_id:{type:mongoose.Types.ObjectId,ref:"items",required:true},
    delivery_time:{type:String,enum:["priority","standard"],default:"standard"},
    pay_price:{type:Number,required:true},
    payment_method:{type:String,required:true},
    quantity:{type:Number,required:true},
    order_number:{type:String,required:true},
    delivery_address:{type:String,required:true},
    user_id:{type:mongoose.Types.ObjectId,ref:"users",required:true},
    order_type:{type:String,enum:["delivery","pickup"],default:"delivery"}
})
module.exports = mongoose.model('order',o_schema);