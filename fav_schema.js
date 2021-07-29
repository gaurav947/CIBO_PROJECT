var mongoose = require('mongoose');

var db = require('./db_init');

var f_schema = new mongoose.Schema({
    seller_id:{type:mongoose.Types.ObjectId,ref:"users",required:true},
    user_id:{type:mongoose.Types.ObjectId,ref:"users",required:true},
    item_id:{type:mongoose.Types.ObjectId,ref:"items",required:true},
    like_status:{type:Boolean,enum:[true,false],required:true}
})
module.exports = new mongoose.model('favorite',f_schema);