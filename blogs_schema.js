var mongoose = require('mongoose');

mongoose.connect("mongodb://localhost:27017/CIBO",{useNewUrlParser:true,useUnifiedTopology:true}).then(res=>{
    console.log("Database created by BLOG_schema");
}).catch(err=>{
    console.log(err);
})

var b_schema = new mongoose.Schema({
    user_id:{type:mongoose.Types.ObjectId,ref:'users',required:true},
    image:{type:String,required:true},
    title:{type:String,required:true},
    desc:{type:String,required:true}
});

module.exports = mongoose.model("blogs",b_schema);