var mongoose = require('mongoose');
var db = require('./db_init');
var u_schema = new mongoose.Schema({
    image:{type:String,default:"image//default.png"},
    name:{type:String,minlength:5,maxlength:20,required:true},
    email:{type:String,required:true,unique:true},
    phone_number:{type:Number,min:6666666666,maxlength:9999999999,required:true,unique:true},
    password:{type:String,required:true},
    bio:{type:String},
    location:{type:{type:String},coordinates:{type:[]}},
    lat:{type:Number,default:0},
    long:{type:Number,default:0},
    otp:{type:Number},
    google_id:{type:String},
    facebook_id:{type:String}
})
u_schema.index({
    location: "2dsphere"
})
module.exports = new mongoose.model("user",u_schema,'users');

