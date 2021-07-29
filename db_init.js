var mongoose = require('mongoose');
var db = "mongodb+srv://sun_user_23:sun_user_23@cluster0.cu4zq.mongodb.net/CIBO?retryWrites=true&w=majority";
mongoose.connect(db,{useNewUrlParser:true,useUnifiedTopology:true}).then(res=>{
    console.log("Database initialized!....")
}).catch(err=>{
    console.log(err);
});
