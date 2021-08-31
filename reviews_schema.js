var mongoose = require("mongoose");
var db = require("./db_init");

var r_schema = new mongoose.Schema({
	user_id:{type:mongoose.Types.ObjectId,ref:"users",required:true},
	seller_id:{type:mongoose.Types.ObjectId,ref:"users",required:true},
	order_id:{type:mongoose.Types.ObjectId,ref:"orders",required:true},
	star:{type:Number,required:true},
	message:{type:String,required:true}
});

module.exports = new mongoose.model("review",r_schema);