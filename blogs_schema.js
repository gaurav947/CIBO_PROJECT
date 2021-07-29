var mongoose = require('mongoose');

var db = require('./db_init');
var b_schema = new mongoose.Schema({
    user_id:{type:mongoose.Types.ObjectId,ref:'users',required:true},
    image:{type:String,required:true},
    title:{type:String,required:true},
    desc:{type:String,required:true}
});

module.exports = mongoose.model("blogs",b_schema);