var mongoose = require("mongoose");
var db = require('./db_init');

var s_schema = new mongoose.Schema({
    image:String,
    bio:String,
    Pancard_info:{
        card_no:{type:String,minlength:10,required:true},
        Image:{type:String,required:true},
    },
    Adhaar_info:{
        card_no:{type:Number,required:true},
        Image_front:{type:String,required:true},
        Image_back:{type:String,required:true},
    },
    Address:{
        street_name:String,
        city:String,
        state:String,
        Pin:Number
    },
    Bank_details:{
        Account_number:Number,
        A_holder_name:String,
        IFSE_code:String,
        Bank_name:String
    },
    verified_seller:{type:Boolean},
    Delivery_options:{type:String,enum:['delivery','pickup_only'],default:"pickup_only"},
    schedule:{
        Date:{type:Date,required:true},
        start_time:{type:String,required:true},
        end_time:{type:String,required:true}
    }
});
module.exports = new mongoose.model('seller',s_schema,'users');
