var mongoose = require('mongoose');
var db = require('./db_init');

var i_schema = new mongoose.Schema({
    seller_id:{type:mongoose.Types.ObjectId,ref:"users",required:true},
    i_image:{type:String,required:true},
    item_name:{type:String,required:true},
    category:{type:String,required:true},
    price:{type:Number,required:true},
    description:{type:String,required:true},
    special_notes:{type:String,required:true},
    date:{type:Date,default:Date.now}
});

module.exports = mongoose.model('item',i_schema);