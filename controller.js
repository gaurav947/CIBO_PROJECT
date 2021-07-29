var mongoose = require("mongoose");
var express = require('express');

var app = express();

var user = require('./user_schema');
var seller = require('./seller_schema');
var item = require('./item_schema');
var blogs = require('./blogs_schema');
var favorite = require('./fav_schema');

var bodyParser = require("body-parser");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
var cors = require('cors');
app.use(cors());

mongoose.set("useFindAndModify", false);
var redis = require('redis');
var JWTR = require('jwt-redis').default;
//ES6 import JWTR from 'jwt-redis';
var redisClient = redis.createClient();
var jwtr = new JWTR(redisClient);

//otp-generator => for generating OTP
var otpGenerator = require("otp-generator");

//bcrypt => for hashing
var bcrypt = require("bcrypt");
var saltRounds = 10;

var middleware = require('./middleware');
var nodemailer = require("nodemailer");

app.set('view engine', 'ejs');

app.use(express.static(__dirname));
var multer = require('multer');
var path = require('path');
const { resolveSoa } = require("dns");
const storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, './image');
    },
    filename: function (req, file, callback) {
        callback(null, file.fieldname + Date.now() + path.extname(file.originalname));
    }
})
const upload = multer({ storage: storage });
//for creating user
app.post("/user", function (req, res) {
    if (req.body.password !== req.body.confirm_p) {
        return res.status(400).json({
            error: true,
            message: "Passwords are not matched!!.."
        })
    }
    else if (/^[a-zA-Z0-9]+[@][a-z]+[\.][a-z]{2,3}$/.test(req.body.email) == false && req.body.email) {
        return res.status(400).json({
            error: true,
            message: "Please check your mail is not in format"
        })
    }
    else if (req.headers.authorization && req.body.otp) {
        token = req.headers.authorization.split(' ')[1];
        jwtr.verify(token, "creation").then((tokenv) => {
            console.log(tokenv);
            user.findOne({ _id: tokenv._id }, function (err, result) {
                if (result.otp === req.body.otp) {
                    return res.status(200).json({
                        status: true,
                        verify: true,
                        message: "Phone number verification Approved...."
                    })
                }
                else {
                    return res.status(400).json({
                        error: true,
                        verify: false,
                        message: "Phone number verification failed!"
                    })
                }
            })
        }).catch((tokenv_err) => {
            return res.status(400).json({
                error: true,
                message: "Something went wrong"
            })
        })
    }
    else if (req.headers.authorization && req.body.lat && req.body.long) {
        if (req.body.lat && req.body.long) {
            token = req.headers.authorization.split(' ')[1];
            var location = {
                type: "Point",
                coordinates: [parseFloat(req.body.long), parseFloat(req.body.lat)]
            }
            var lat = parseFloat(req.body.lat);
            var long = parseFloat(req.body.long);
            jwtr.verify(token, "creation").then((tokenv) => {
                console.log(tokenv);
                user.updateOne({ _id: tokenv._id }, { location: location, lat: lat, long: long }, function (err, result) {
                    if (result.otp === req.body.otp) {
                        return res.status(200).json({
                            status: true,
                            message: "Location registered sucessfully!"
                        })
                    }
                    else {
                        return res.status(400).json({
                            error: true,
                            message: "Error while updating"
                        })
                    }
                })
            }).catch((tokenv_err) => {
                return res.status(400).json({
                    error: true,
                    message: "Something went wrong"
                })
            })
        }
    }
    else {
        if (req.body.phone_number.toString().length != 10 && req.body.phone_number) {
            return res.status(400).json({
                error: true,
                message: "Phone number length should be 10"
            })
        }
        if ((req.body.password).length < 6) {
            return res.status(400).json({
                error: true,
                message: "Password length should be 6 or more"
            })
        }
        var o = otpGenerator.generate(5, { digits: true, alphabets: false, upperCase: false, specialChars: false });
        bcrypt.hash(req.body.password, saltRounds, function (b_err, b_result) {
            if (b_result) {
                var data = {
                    email: req.body.email,
                    name: req.body.name,
                    phone_number: req.body.phone_number,
                    otp: o,
                    password: b_result
                }
                user.create(data, function (err, result) {
                    if (result) {
                        var add = {
                            _id: result._id,
                            name: result.name,
                            email: result.email,
                            phone_number: result.phone_number
                        }
                        jwtr.sign(add, "creation").then((c_token) => {
                            return res.json({
                                status: true,
                                otp: o,
                                token: c_token,
                                message: "User created!"
                            })
                        }).catch((c_err) => {
                            return res.status(400).json({
                                error: true,
                                message: "Something went wrong"
                            })
                        })

                    }
                    if (err) {
                        return res.status(400).json({
                            error: true,
                            err: err,
                            message: "Error while storing data"
                        })
                    }
                })
            }
            if (b_err) {
                return res.status(400).json({
                    error: true,
                    message: "Something went wrong"
                })
            }
        })
    }
})
//for updating user detail
app.post("/update-user", upload.any(), middleware.isloggedin, function (req, res) {
    if (/^[a-zA-Z0-9]+[@][a-z]+[\.][a-z]{2,3}$/.test(req.body.email) == false && req.body.email) {
        return res.status(400).json({
            error: true,
            message: "Please check your mail is not in format"
        })
    }
    else if (req.body.phone_number.toString().length != 10 && req.body.phone_number) {
        return res.status(400).json({
            error: true,
            message: "Phone number length should be 10"
        })
    }
    else {
        token = req.headers.authorization.split(' ')[1];
        jwtr.verify(token, "creation").then(tokenv => {
            if (req.files.length) {
                user.updateOne({ _id: tokenv._id }, {
                    image: req.files[0].path, name: req.body.name, email: req.body.email, phone_number: req.body.phone_number,
                    bio: req.body.bio
                }, function (err, result) {

                    if (result) {
                        return res.json({
                            status: true,
                            message: "Your detail is updated!"
                        })
                    }
                    if (err) {
                        return res.status(400).json({
                            error: true,
                            message: "Error while updating your detail"
                        })
                    }
                })
            }
            else if (!req.files.length) {
                user.updateOne({ _id: tokenv._id }, {
                    name: req.body.name, email: req.body.email, phone_number: req.body.phone_number,
                    bio: req.body.bio
                }, function (err, result) {
                    if (result) {
                        return res.json({
                            status: true,
                            message: "Your detail is updated!"
                        })
                    }
                    if (err) {
                        return res.status(400).json({
                            error: true,
                            message: "Error while updating your detail"
                        })
                    }
                })
            }
        }).catch(err => {
            return res.json({
                error: err,
                message: "Something went wrong"
            })
        })
    }
})
//for viewing the profile detail
app.get("/view-profile", middleware.isloggedin, function (req, res) {
    token = req.headers.authorization.split(' ')[1];
    jwtr.verify(token, "creation").then(tokenv => {
        user.findOne({ _id: tokenv._id }, function (err, result) {
            if (result) {
                let data = {
                    image: `http://localhost:4000/${result.image}`,
                    name: result.name,
                    email: result.email,
                    phone_number: result.phone_number,
                    bio: result.bio
                }
                return res.json({
                    status: true,
                    data: data,
                    message: "User data fetched sucessfully"

                })
            }
            if (err) {
                return res.status(400).json({
                    error: true,
                    err: err,
                    message: "Error while fetching data"
                })
            }
        })
    }).catch(err => {
        return res.status(400).json({
            error: true,
            err: err,
            message: "Something went wrong"
        })
    })
})
//login for user
app.post('/login', function (req, res) {
    if(req.body.type==="mannual"){
        if (req.body.email != "" && req.body.password != "") {
        user.findOne({ email: req.body.email }, function (err, result) {
            if (result) {
                bcrypt.compare(req.body.password, result.password, function (c_err, c_sucess) {
                    if (c_sucess == true) {
                        var add = {
                            _id: result._id,
                            name: result.name,
                            email: result.email,
                            phone_number: result.phone_number
                        }
                        jwtr.sign(add, "creation").then((c_token) => {
                            return res.json({
                                status: true,
                                token: c_token,
                                message: "login  Sucessfully!"
                            })
                        }).catch((c_err) => {
                            return res.status(400).json({
                                error: true,
                                message: "Something went wrong"
                            })
                        })
                    }
                    if (c_err || c_sucess == false) {
                        return res.status(400).json({
                            error: true,
                            message: "Your password is Invalid!.."
                        })
                    }
                })
            }
            else {
                return res.status(400).json({
                    error: true,
                    err: err,
                    message: "Login failed",
                    status: 400
                })
            }
        })
        }
        else {
            return res.status(400).json({
                error: true,
                message: "Please fill all the fields"
            })
        }
    }
    else if(req.body.type === 'google')
    {
        if(req.body.google_id!="" && req.body.email!= "" && req.body.name != "")
        {
            user.findOne({google_id:req.body.google_id},function(err,result){
                if(result && result.length)
                {
                    return res.json({
                        sucess:true,
                        message:"Login"
                    })
                }
                else if(result)
                {
                    user.create({google_id:req.body.google_id,name:req.body.name,email:req.body.email},function(err,result){
                        if(result)
                        {
                            return res.json({
                                sucess:true,
                                message:"login with user register"
                            })
                        }
                        else if(err)
                        {
                            return res.status.json({
                                error:true,
                                message:err
                            })
                        }
                    })
                }
                else
                {
                    return res.status(400).json({
                        error:true,
                        message:""
                    })
                }
            })
        }
        else
        {
            return res.status(400).json({
                error:true,
                message:"Please give all the required fields"
            })
        }
    }
    else if(req.body.type === 'facebook')
    {
        if(req.body.facebook_id!="" && req.body.email!= "" && req.body.name != "")
        {   
            user.findOne({facebook_id:req.body.facebook},function(err,result){
                if(result && result.length)
                {
                    return res.json({
                        status:true,
                        message:"login already"
                    })
                }
                else if(result)
                {
                    user.create({facebook_id:req.body.facebook_id,name:req.body.name,email:req.body.email},function(err,result){
                        if(result)
                        {
                            return res.json({
                                status:true,
                                message:"login"
                            })
                        }
                        else if(err)
                        {   
                            return res.status(400).json({
                                error:true,
                                message:"Error while login with facebook"
                            })
                        }
                        else
                        {
                            return res.status(400).json({
                                error:true,
                                message:"Check your data"
                            })
                        }
                    })
                }
                else
                {
                    return res.status(400).json({
                        error:true,
                        message:"Something went wrong"
                    })
                }
            })
        }
        else
        {
            return res.status(400).json({
                error:true,
                message:"Please give all the required fields"
            })
        }
    }
})

//become a seller
app.post("/seller", upload.any(), middleware.isloggedin, function (req, res) {
    token = req.headers.authorization.split(' ')[1];
    if (req.files && req.body.street_name && req.body.city && req.body.state && req.body.pin) {
        var j = 0;
        let data = {};
        for (let i = 0; i < (req.files).length; i++) {
            if (req.files[i].fieldname === "pan_Image") {
                j = j + 1;
                data.Pan_Image = req.files[i].path;
            }
            else if (req.files[i].fieldname === "adhaar_front") {
                j = j + 1;
                data.Adhaar_front = req.files[i].path;
            }
            else if (req.files[i].fieldname === "adhaar_back") {
                j = j + 1;
                data.Adhaar_back = req.files[i].path;
            }
            else if (req.files[i].fieldname === "image") {
                data.image = req.files[i].path;
            }
        }
        if (j < 3) {
            return res.status(400).json({
                error: true,
                message: "Please add all the images"
            })
        }
        else if ((req.body.pan_card).length != 10) {
            return res.status(400).json({
                error: true,
                message: "Pan card number must be 10"
            })
        }
        else if (req.body.adhaar_card.toString().length != 12) {
            return res.status(400).json({
                error: true,
                message: "Adhaar card number must have 12 digits"
            })
        }
        else {
            let address = {
                street_name: req.body.street_name,
                city: req.body.city,
                state: req.body.state,
                Pin: req.body.pin
            };
            let adhaar = {
                card_no: req.body.adhaar_card,
                Image_front: data.Adhaar_front,
                Image_back: data.Adhaar_back
            };
            let pan = {
                card_no: req.body.pan_card,
                Image: data.Pan_Image
            };
            if (data.image) {
                jwtr.verify(token, 'creation').then(tokenv => {
                    seller.updateOne({ _id: tokenv._id }, {
                        image: data.image,
                        Pancard_info: pan,
                        Adhaar_info: adhaar,
                        Address: address
                    }, function (err, result) {
                        if (result) {
                            return res.json({
                                sucess: true,
                                message: "Your data is uploaded"
                            })
                        }
                        if (err) {
                            return res.status(400).json({
                                error: true,
                                message: "Error while uploading data"
                            })
                        }
                    })

                }).catch(err => {
                    return res.status(400).json({
                        error: true,
                        message: "Something went wrong"
                    })
                })
            }
            else {
                jwtr.verify(token, 'creation').then(tokenv => {
                    seller.updateOne({ _id: tokenv._id }, {
                        Pancard_info: pan,
                        Adhaar_info: adhaar,
                        Address: address
                    }, function (err, result) {
                        if (result) {
                            return res.json({
                                sucess: true,
                                message: "Your data is uploaded"
                            })
                        }
                        if (err) {
                            return res.status(400).json({
                                error: true,
                                message: "Error while uploading data"
                            })
                        }
                    })

                }).catch(err => {
                    return res.status(400).json({
                        error: true,
                        message: "Something went wrong"
                    })
                })
            }
        }
    }
    else if (req.body.account_number && req.body.account_holder_name && req.body.ifse && req.body.bank_name) {
        if (req.body.account_number.toString().length < 10) {
            return res.status(400).json({
                error: true,
                message: "Account nummber should be greater then or equal to 10"
            })
        }
        else if ((req.body.account_holder_name).length < 5) {
            return res.status(400).json({
                error: true,
                message: "Length is too short for holder_name"
            })
        }
        else if ((req.body.ifse).length != 11) {
            return res.status(400).json({
                error: true,
                message: "Length for IFSE code should be 11 "
            })
        }
        else {
            var bank = {
                Account_number: req.body.account_number,
                A_holder_name: req.body.account_holder_name,
                IFSE_code: req.body.ifse,
                Bank_name: req.body.bank_name
            }
            jwtr.verify(token, "creation").then(tokenv => {
                seller.updateOne({ _id: tokenv._id }, { Bank_details: bank }, function (err, result) {
                    if (result) {
                        return res.json({
                            sucess: true,
                            message: "Your bank details are added"
                        })
                    }
                    if (err) {
                        return res.status(400).json({
                            error: true,
                            message: "Error while uploading bank data"
                        })
                    }

                })
            }).catch(err => {
                return res.status(400).json({
                    error: true,
                    message: "Something went wromg"
                })
            })
        }

    }
    else if (req.body.bio) {
        jwtr.verify(token, "creation").then(tokenv => {
            seller.updateOne({ _id: tokenv._id }, { bio: req.body.bio, verified_seller: true }, function (err, result) {
                if (result) {
                    return res.json({
                        status: 200,
                        message: "Bio is registered"
                    })
                }
                if (err) {
                    return res.status(400).json({
                        message: "Error while registering bio"
                    })
                }
            })
        }).catch(err => {
            return res.status(400).json({
                message: "something went wrong"
            })
        })

    }
    else if (req.body.delivery_option) {
        jwtr.verify(token, "creation").then(tokenv => {
            seller.findOneAndUpdate({ _id: tokenv._id }, { Delivery_options: req.body.delivery_option }, { new: true, runValidators: true }, function (err, result) {
                if (result) {
                    return res.json({
                        sucess: true,
                        message: "Delivery option registered"
                    })
                }
                if (err) {
                    return res.status(400).json({
                        error: true,
                        err: err.message,
                        message: "Error while registering "
                    })
                }
            })

        }).catch(err => {
            return res.status(400).json({
                error: true,
                message: "Something went wrong"
            })
        })
    }

})
//set schedule for sellerqq
app.post("/schedule", middleware.isloggedin, function (req, res) {
    token = req.headers.authorization.split(' ')[1];
    if (req.body.date && req.body.start && req.body.end) {
        let schedule = {
            Date: req.body.date,
            start_time: req.body.start_time,
            end_time: req.body.end_time
        }
        jwtr.verify(token, "creation").then(tokenv => {
            seller.findOneAndUpdate({ _id: tokenv._id }, { schedule: schedule }, function (err, result) {
                if (result) {
                    return res.json({
                        status: true,
                        message: "Your schedule is stored"
                    })
                }
                if (err) {
                    return res.status(400).json({
                        error: true,
                        message: "Error while scheduling.."
                    })
                }
            })
        }).catch(err => {
            return res.status(400).json({
                error: true,
                message: "Something went wrong"
            })
        })
    }
    else {
        return res.status(400).json({
            error: true,
            message: "fill all the fields"
        })
    }
})

//forget 
var valid = 0;
app.post('/forget', function (req, res) {
    var transporter = nodemailer.createTransport({
        host: "smtp.mailtrap.io",
        port: 2525,
        auth: {
            user: "596caf575abd7f",
            pass: "739f87e138ed54"
        }
    });
    let url = '<a href="http://' + req.headers.host + '/forget-reset-password/' + req.body.email + '">http://' + req.headers.host + '/reset-password/' + req.body.email + '</a>';
    let info = transporter.sendMail({
        from: 'CIBO@gmail.com', // sender address
        to: req.body.email, // list of receivers
        subject: "CIBO Reset password ", // Subject line
        text: "Hello world?", // plain text body
        html: '<p>We just acknowledged that you have requested to change your account password. You can change your password by clicking on the link below.</p>' + url + '<p>If you did not make this request. Please ignore this email.</p>' // html body
    });
    return res.json({
        sucess: true,
        message: "Link send to your email"
    })
});
app.get('/forget-reset-password/:email', function (req, res) {
    res.render('reset', { email: req.params.email });
    valid = 1;
})
app.post('/forget-response/:email', function (req, res) {
    if (req.body.New_password != req.body.confirm_password) {
        return res.status(400).json({
            error: true,
            message: "your Passwords are not matched"
        })
    }
    else if ((req.body.New_password).length < 6) {
        return res.status(400).json({
            error: true,
            message: "Password length should be 6 or more"
        })
    }
    else if (req.body.New_password == "" && req.boy.confirm_password == "" || req.body.New_password == "" || req.body.confirm_password == "") {
        return res.status(400).json({
            error: true,
            message: "Please fill all the fields"
        })
    }
    else {
        bcrypt.hash(req.body.New_password, saltRounds, function (b_err, b_result) {
            if (b_result && valid) {
                user.updateOne({ email: req.params.email }, { password: b_result }).then(result => {
                    valid = 0;
                    return res.json({
                        sucess: true,
                        message: "Your password is now change"
                    })
                }).catch(err => {
                    return res.status(400).json({
                        error: err,
                        message: "Error while changing password"
                    })
                })
            }
            else if (!valid) {
                return res.status(400).json({
                    error: true,
                    message: "Something went wrong"
                })
            }
            if (b_err) {
                return res.status(400).json({
                    error: err,
                    message: "Something went wrong"
                })
            }
        })

    }

})

//favorites
app.post('/favorite', middleware.isloggedin, function (req, res) {
    token = req.headers.authorization.split(' ')[1];
    if (req.body.seller_id == '' || req.body.item_id == '' || req.body.like_status === '') {
        return res.status(400).json({
            error: true,
            message: "Please fill all the blanks"
        });
    }
    else {
        jwtr.verify(token, 'creation').then(tokenv => {
            favorite.findOne({ user_id: tokenv._id, item_id: req.body.item_id }, function (err, result) {
                if (tokenv._id != req.body.seller_id) {
                    if (result && req.body.like_status === true) {
                        return res.status(400).json({
                            error: true,
                            message: "This item is already liked by you!!"
                        });
                    }
                    else if (err) {
                        return res.status(400).json({
                            error: true,
                            message: "Something went wrong"
                        });
                    }
                    else if (req.body.like_status === true) {
                        let data = {
                            seller_id: req.body.seller_id,
                            user_id: tokenv._id,
                            item_id: req.body.item_id,
                            like_status: req.body.like_status
                        }
                        favorite.create(data, function (err, result) {
                            if (result) {
                                return res.json({
                                    sucess: true,
                                    message: "You favorite this item"
                                })
                            }
                            if (err) {
                                return res.status(400).json({
                                    error: true,
                                    message: "Error while favorite this item"
                                })
                            }
                        });
                    }
                    else if (req.body.like_status === false) {
                        favorite.deleteOne({ user_id: tokenv._id, item_id: req.body.item_id }, function (err, result) {
                            if (result && result.deletedCount) {
                                return res.json({
                                    sucess: true,
                                    message: "This item removed sucessfully from your Favorite list"
                                })
                            }
                            else {
                                return res.status(400).json({
                                    error: true,
                                    message: "Something went wrong"
                                })
                            }
                        })
                    }
                    else {
                        return res.status(400).json({
                            error: true,
                            message: "Something went wrong"
                        })
                    }
                }
                else
                {
                    return res.status(400).json({
                        error: true,
                        message: "Something went wrong"
                    })
                }
            });
        }).catch(err => {
            return res.status(400).json({
                error: true,
                message: "Something went wrong"
            })
        })
    }
})

app.get('/view-favorite',middleware.isloggedin,function(req,res){
    token = req.headers.authorization.split(' ')[1];
    jwtr.verify(token, "creation").then(tokenv => {
        user.findOne({ _id: tokenv._id }, function (err, result) {
            if(result){
                item.aggregate([
                    {
                        $lookup:{
                            from:"favorites",
                            let:{i_id:"$_id"},
                            pipeline:[
                                {
                                    $match:{
                                        $expr:{
                                            $and:[
                                                {$eq:["$$i_id","$item_id"]},
                                               {$eq:["$user_id",mongoose.Types.ObjectId(tokenv._id)]}
                                            ]
                                        }
                                    }
                                }                        
                            ],
                            as:"favorites"
                        }
                    },
                    {
                        $unwind:"$favorites"
                    },
                    {
                        $lookup:{
                            from:"users",
                            let:{sellerid:'$seller_id'},
                            pipeline:[
                                {
                                    $geoNear:{
                                            near: { type: "point", coordinates: [result.long, result.lat] },
                                            distanceField: "dist.calculated",
                                            maxDistance: 5 * 1000,
                                            distanceMultiplier: 1 / 1000,
                                            spherical: true
                                    }
                                },
                                {
                                    $match:{
                                        $expr:{
                                            $and:[
                                                {$eq:["$$sellerid","$_id"]}
                                            ]
                                        }
                                    }
                                    }
                                     
                            ],
                            as:'seller'
                        }
                    },
                    {
                        $unwind:"$seller"
                    },
                    {
                        $project:{
                            "i_image":1,
                            "item_name":1,
                            "price":1,
                            "seller_name":"$seller.name",
                            "distance":"$seller.dist.calculated"
                            

                        }
                    }
        
                ],function(error,data){
                    if(data)
                    {
                        return res.json({
                            sucess:true,
                            result:data
                        })
                    }
                    if(error)
                    {
                        return res.status(400).json({
                            error:true,
                            Message:error
                        })
                    }
                })
            }
        })
    }).catch(err=>{
        return res.status(400).json({
            error:true,
            message:"Something went wrong"
        })
    })
    
})

//blogs
app.post("/blog", upload.any(), middleware.isloggedin, function (req, res) {
    token = req.headers.authorization.split(' ')[1];
    jwtr.verify(token, "creation").then(tokenv => {
        let data = {
            user_id: tokenv._id,
            image: req.files[0].path,
            title: req.body.title,
            desc: req.body.description
        }
        blogs.create(data, function (err, result) {
            if (result) {
                return res.json({
                    sucess: true,
                    message: "Your blog is stored sucessfully"
                })
            }
            if (err) {
                return res.status(400).json({
                    error: true,
                    message: "Error in blogs"
                })
            }
        })
    }).catch(err => {
        return res.status(400).json({
            error: true,
            err: err,
            message: "Something went wrong"
        })
    })

})
//storing items by seller
app.post('/add-items', upload.any(), middleware.isloggedin, function (req, res) {
    token = req.headers.authorization.split(' ')[1];
    if (req.body.item_name.length < 6) {
        return res.status(400).json({
            error: true,
            message: "Item name is too short"
        })
    }
    else {
        jwtr.verify(token, "creation").then(tokenv => {
            seller.findOne({ _id: tokenv._id }, function (err, result) {
                if (result.verified_seller) {
                    let data = {
                        seller_id: tokenv._id,
                        i_image: req.files[0].path,
                        item_name: req.body.item_name,
                        category: req.body.category,
                        price: req.body.price,
                        description: req.body.description,
                        special_notes: req.body.special_notes
                    }
                    item.create(data, function (err, result) {
                        if (result) {
                            return res.json({
                                status: true,
                                message: "Your item is added"
                            })
                        }
                        if (err) {
                            return res.status(400).json({
                                error: true,
                                err: err,
                                message: "Error while adding"
                            })
                        }
                    })
                }
                else if (err) {
                    return res.status(400).json({
                        error: true,
                        message: "Something went wrong"
                    })
                }
                else {
                    return res.status(400).json({
                        error: true,
                        message: "May be you are not a valid seller"
                    })
                }
            })
        }).catch(err => {
            return res.status(400).json({
                message: "Something went wrong"
            })
        })
    }
})

//new item on the App
app.get('/new-items', middleware.isloggedin, function (req, res) {
    token = req.headers.authorization.split(' ')[1];
    jwtr.verify(token, "creation").then(tokenv => {
        user.findOne({ _id: tokenv._id }, function (err, result) {
            if (result) {
                item.aggregate([
                    {
                        $sort: { "date": -1 }
                    },
                    {
                        $lookup: {
                            from: "users",
                            let: { seller_id: "$seller_id" },
                            pipeline: [
                                {
                                    $geoNear: {
                                        near: { type: "point", coordinates: [result.long, result.lat] },
                                        distanceField: "dist.calculated",
                                        maxDistance: 5 * 1000,
                                        distanceMultiplier: 1 / 1000,
                                        spherical: true
                                    }
                                },
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$$seller_id", "$_id"] },
                                                {
                                                    $ne: ["$$seller_id", mongoose.Types.ObjectId(tokenv._id)]
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    $project: {
                                        "dist.calculated": 1
                                    }
                                }

                            ],
                            as: "seller"
                        }
                    },
                    {
                        $lookup:{
                            from:"favorites",
                            let:{i_id:"$_id"},
                            pipeline:[
                                {
                                    $match:{
                                        $expr:{
                                            $and:[
                                                {$eq:["$$i_id","$item_id"]},
                                               {$eq:["$user_id",mongoose.Types.ObjectId(tokenv._id)]}
                                            ]
                                        }
                                    }
                                }                        
                            ],
                            as:"favorites"
                        }
                    },
                    {
                        $unwind:{
                           path:"$favorites",
                           preserveNullAndEmptyArrays:true
                        }
                    },
                    {
                        $unwind: "$seller"
                    },
                    {
                        $project: {
                            "i_image": 1,
                            "item_name": 1,
                            "category":1,
                            "distance": "$seller.dist.calculated",
                            "seller_id": 1,
                            "liked":"$favorites.like_status"
                        }
                    }

                ], function (err, result) {
                    if (result && result.length) {
                        return res.json({
                            sucess: true,
                            data: result
                        })
                    }
                    if (err) {
                        return res.status(400).json({
                            sucess: true,
                            data: result
                        })
                    }
                    else
                    {
                        return res.json({
                            sucess:true,
                            data:"No data available..."
                        })
                    }
                })

            }
        })
    }).catch(err => {
        console.log(err);
    });

})

//openning item
app.get('/view_item1', middleware.isloggedin, function (req, res) {
    item.findOne({ _id: req.body.item_id }, function (err, result) {
        if (result) {
            return res.json({
                item: result,
                sucess: true,
                message: "Item fetched sucessfully"
            })
        }
        if (err) {
            return res.status(400).json({
                error: true,
                message: "Error while fetching item"
            })
        }
    })
})

//change-password
app.post('/change-password', middleware.isloggedin, function (req, res) {
    if ((req.body.new_password).length < 6) {
        return res.status(400).json({
            error: true,
            message: "New Password length should be 6 or more"
        })
    }
    token = req.headers.authorization.split(' ')[1];
    if (req.body.old_password && req.body.new_password && req.body.confirm_password) {
        jwtr.verify(token, 'creation').then(tokenv => {
            user.findOne({ _id: tokenv._id }, function (err, result) {
                if (result) {
                    bcrypt.compare(req.body.old_password, result.password, function (b_err, b_result) {
                        if (b_result) {
                            if (req.body.new_password === req.body.confirm_password) {
                                bcrypt.hash(req.body.new_password, saltRounds, function (bb_err, bb_result) {
                                    if (bb_result) {
                                        user.updateOne({ _id: tokenv._id }, { password: bb_result }, function (u_err, u_result) {
                                            if (u_result) {
                                                return res.json({
                                                    sucess: true,
                                                    message: "Your password is sucessfully changed!!"
                                                })
                                            }
                                            else if (u_err) {
                                                return res.status(400).json({
                                                    error: true,
                                                    message: "Error while updating password"
                                                })
                                            }
                                        })
                                    }
                                    if (bb_err) {
                                        return res.status(400).json({
                                            error: true,
                                            message: "Error while updating password"
                                        })
                                    }
                                })

                            }
                            else {
                                return res.status(400).json({
                                    error: true,
                                    message: "Your New password and confirm password are not matched!!"
                                })
                            }
                        }
                        else if (b_result === false) {
                            return res.status(400).json({
                                error: true,
                                message: "Old password not matched!"
                            })
                        }
                        else {
                            return res.status(400).json({
                                error: true,
                                message: "Something went wrong"
                            })
                        }
                    })
                }
                if (err) {
                    return res.status(400).json({
                        error: true,
                        message: "Something went wrong"
                    })
                }
            })
        })
    }
})
//logout
app.post("/logout", middleware.isloggedin, function (req, res) {
    token = req.headers.authorization.split(' ')[1];
    jwtr.verify(token, 'creation').then((tokenv) => {
        jwtr.destroy(tokenv.jti).then((destroy) => {
            return res.json({
                message: destroy,
                sucess: true
            })
        })
    }).catch((token_err) => {
        return res.status(400).json({
            error: true,
            message: "Something went wrong"
        })
    })
})

//server listen
app.listen('4000', function (err, res) {
    if (res)
        console.log("Port is activated at 4000")
    if (err) {
        console.log(err);
        console.log("Problem with activating port");
    }

})