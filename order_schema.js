var mongoose = require('mongoose');
var db = require('./db_init');
var allitem_schema = new mongoose.Schema({
    item_id:{type:mongoose.Types.ObjectId,ref:"items"},
    quantity:{type:String},
    price:{type:Number},
    item_image:String,
    item_name:String,
    special_i:String,
});
var o_schema = new mongoose.Schema({
    all_item:[allitem_schema],
    delivery_time:{type:String,enum:["priority","standard"],default:"standard"},
    total_price:{type:Number},
    payment_method:{type:String,required:true},
    order_number:{type:String,required:true},
    delivery_address:{type:String,required:true},
    user_id:{type:mongoose.Types.ObjectId,ref:"users",required:true},
    seller_id:{type:mongoose.Types.ObjectId,ref:"users"},
    order_type:{type:String,enum:["delivery","pickup_only"],default:"delivery"},
    order_status:{type:String,enum:["pending","cancel","track","completed"],default:"pending"},
    seller_status:{type:String,enum:["request","completed","pending","reject"],default:"request"},
    date:{type:Date,default:Date.now}
})
module.exports =  mongoose.model('order',o_schema);
