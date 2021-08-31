//requiring mongoose
var mongoose = require("mongoose");
//requiring express
var express = require("express");

//adding express to app variable
var app = express();

//requiring user_schema for adding or getting data 
var user = require("./user_schema");
//require seller_schema
var seller = require("./seller_schema");
//require item_schema
var item = require("./item_schema");
//require blogs_schema
var blogs = require("./blogs_schema");
//require fav_schema
var favorite = require("./fav_schema");
//require addToCart_schema
var addToCart = require("./addToCart_schema");
//require order_schema
var order = require("./order_schema");
//require reviews_schema
var review = require("./reviews_schema");

//using express.json() for parsing data to json
app.use(express.json());
//using express.urlencoded
app.use(express.urlencoded({ extended: false }));
//requiring CORS
var cors = require ("cors");
app.use(cors());


mongoose.set("useFindAndModify", false);

//otp-generator => for generating OTP
var otpGenerator = require("otp-generator");
//requiring util
const util = require("util");
var _jwt = require("jwtr");
const jwtVerify = util.promisify(_jwt.verify);
const jwtSign = util.promisify(_jwt.sign);

//bcrypt => for encrypting the password
var bcrypt = require("bcrypt");
var saltRounds = 10;

var middleware = require("./middleware");
var nodemailer = require("nodemailer");

//setup of ejs templates
app.set("view engine", "ejs");

//requiring dotenv for environment variable
const dotenv = require("dotenv");
dotenv.config();

//requiring multer
var multer = require("multer");

app.use(express.static(__dirname));

//requiring aws-sdk for storing images in s3 bucket
const AWS = require("aws-sdk");
//using multer-s3 for giving path
const multers3 = require("multer-s3");

//access keys of IAM user
const s3 = new AWS.S3({
	accessKeyId:process.env.AWS_ACCESS_KEY,
	secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY
});

//adding filefilter
const fileFilter = (req, file, cb) => {
	if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
		cb(null, true);
	} else {
		cb(null, false);
	}
};

//upload through multer
const upload = multer({fileFilter,storage: multers3({
	acl: "public-read",
	s3,
	bucket: process.env.AWSBucketName,
	metadata: function (req, file, cb) {
		cb(null, { fieldName: "TESTING_METADATA" });
	},
	contentType: multers3.AUTO_CONTENT_TYPE,
	key: function (req, file, cb) {
		cb(null, Date.now().toString()+path.extname(file.originalname));
	},
}),
});


var path = require("path");
const { resolveSoa } = require("dns");
// const JWTR = require("jwtr/src/JWTR");
const { TimestreamQuery } = require("aws-sdk");

//for creating user
app.post("/user", function (req, res) {
	//check the password are same
	if (req.body.password !== req.body.confirm_p) {
		return res.status(400).json({
			error: true,
			message: "Passwords are not matched!!.."
		});
	}
	//checking the format for email validation
	else if (/^[a-zA-Z0-9\.]+[@][a-z]+[\.][a-z]{2,3}$/.test(req.body.email) == false && req.body.email) {
		return res.status(400).json({
			error: true,
			message: "Please check your mail is not in format"
		});
	}
	//generating the OTP
	else if (req.headers.authorization && req.body.otp) {
		var token = req.headers.authorization.split(" ")[1];
		jwtVerify(token, "creation").then((tokenv) => {
			user.findOne({ _id: tokenv._id }, function (err, result) {
				if (result.otp === req.body.otp) {
					return res.status(200).json({
						status: true,
						verify: true,
						message: "Phone number verification Approved...."
					});
				}
				else {
					return res.status(400).json({
						error: true,
						verify: false,
						message: "Phone number verification failed!"
					});
				}
			});
		}).catch((tokenv_err) => {
			return res.status(400).json({
				error: true,
				error_message:tokenv_err,
				message: "Something went wrong"
			});
		});
	}
	//storing lat and long
	else if (req.headers.authorization && req.body.lat && req.body.lng && req.body.delivery_address) {
		token = req.headers.authorization.split(" ")[1];
		var location = {
			type: "Point",
			coordinates: [parseFloat(req.body.lng), parseFloat(req.body.lat)]
		};
		var lat = parseFloat(req.body.lat);
		var long = parseFloat(req.body.lng);
		jwtVerify(token, "creation").then((tokenv) => {
			user.updateOne({ _id: tokenv._id }, { location: location, lat: lat, long: long, delivery_address:req.body.delivery_address}, function (err, result) {
				if (result.otp === req.body.otp) {
					return res.status(200).json({
						status: true,
						message: "Location registered sucessfully!"
					});
				}
				else {
					return res.status(400).json({
						error: true,
						message: "Error while updating"
					});
				}
			});
		}).catch((tokenv_err) => {
			return res.status(400).json({
				error: true,
				message: "Something went wrong"
			});
		});
	}
	else {
		//checking the phone number length
		if (req.body.phone_number.toString().length != 10 && req.body.phone_number) {
			return res.status(400).json({
				error: true,
				message: "Phone number length should be 10"
			});
		}
		//checking the password length
		if ((req.body.password).length < 6) {
			return res.status(400).json({
				error: true,
				message: "Password length should be 6 or more"
			});
		}
		//generating otp from otpGenerator
		var otp = otpGenerator.generate(5, { digits: true, alphabets: false, upperCase: false, specialChars: false });
		//encrypting the password
		bcrypt.hash(req.body.password, saltRounds, function (b_err, b_result) {
			if (b_result) {
				//storing All data in data object
				var data = {
					email: req.body.email,
					name: req.body.name,
					phone_number: req.body.phone_number,
					otp: otp,
					password: b_result
				};
				//storing data in user collection
				user.create(data, function (err, result) {
					if (result) {
						var add = {
							_id: result._id,
							name: result.name,
							email: result.email,
							phone_number: result.phone_number
						};
						//create a token and store some data it in token
						jwtSign(add, "creation").then((c_token) => {
							return res.json({
								status: true,
								otp: o,
								token: c_token,
								message: "User created!"
							});
						}).catch((c_err) => {
							return res.status(400).json({
								error: true,
								err_message:c_err,
								message: "Something went wrong"
							});
						});

					}
					if (err) {
						return res.status(400).json({
							error: true,
							err: err,
							message: "Error while storing data"
						});
					}
				});
			}
			if (b_err) {
				return res.status(400).json({
					error: true,
					message: "Something went wrong"
				});
			}
		});
	}
});
//for updating user detail
app.post("/update-user", upload.any(), middleware.isloggedin, function (req, res) {
	//checking the email format
	if (/^[a-zA-Z0-9\.]+[@][a-z]+[\.][a-z]{2,3}$/.test(req.body.email) == false && req.body.email) {
		return res.status(400).json({
			error: true,
			message: "Please check your mail is not in format"
		});
	}
	//checking the phone number length
	else if (req.body.phone_number.toString().length != 10 && req.body.phone_number) {
		return res.status(400).json({
			error: true,
			message: "Phone number length should be 10"
		});
	}
	else {
		var token = req.headers.authorization.split(" ")[1];
		jwtVerify(token, "creation").then(tokenv => {
			//if update have a image
			if (req.files.length) {
				//after validating update the information in user collection
				user.updateOne({ _id: tokenv._id }, {
					image: req.files[0].location, name: req.body.name, email: req.body.email, phone_number: req.body.phone_number,
					bio: req.body.bio
				}, function (err, result) {
					if (result) {
						return res.json({
							status: true,
							message: "Your detail is updated!"
						});
					}
					if (err) {
						return res.status(400).json({
							error: true,
							message: "Error while updating your detail"
						});
					}
				});
			}
			//if update request have not image
			else if (!req.files.length) {
				user.updateOne({ _id: tokenv._id }, {
					name: req.body.name, email: req.body.email, phone_number: req.body.phone_number,
					bio: req.body.bio
				}, function (err, result) {
					if (result) {
						return res.json({
							status: true,
							message: "Your detail is updated!"
						});
					}
					if (err) {
						return res.status(400).json({
							error: true,
							message: "Error while updating your detail"
						});
					}
				});
			}
		}).catch(err => {
			return res.json({
				error: err,
				message: "Something went wrong"
			});
		});
	}
});
//for viewing the profile detail
app.get("/view-profile", middleware.isloggedin, function (req, res) {
	var token = req.headers.authorization.split(" ")[1];
	jwtVerify(token, "creation").then(tokenv => {
		//getting the user profile data
		user.findOne({ _id: tokenv._id }, function (err, result) {
			if (result) {
				let data = {
					image: result.image,
					name: result.name,
					email: result.email,
					address:result.delivery_address,
					phone_number: result.phone_number,
					bio: result.bio
				};
				return res.json({
					status: true,
					data: data,
					message: "User data fetched sucessfully"

				});
			}
			if (err) {
				return res.status(400).json({
					error: true,
					err: err,
					message: "Error while fetching data"
				});
			}
		});
	}).catch(err => {
		return res.status(400).json({
			error: true,
			err: err,
			message: "Something went wrong"
		});
	});
});
//login for user
app.post("/login", function (req, res) {
	//checking if it is login through manual process of login
	if(req.body.type==="manual"){
		//checking the if the email and password are not empty or null
		if (req.body.email != "" && req.body.password != "") {
			//finding the user email in database
			user.findOne({ email: req.body.email }, function (err, result) {
				if (result) {
					//check if its password is same through bcrypt compare
					bcrypt.compare(req.body.password, result.password, function (c_err, c_sucess) {
						if (c_sucess == true) {
							var add = {
								_id: result._id,
								name: result.name,
								email: result.email,
								phone_number: result.phone_number
							};
							//checking if it is seller
							if(result.verified_seller)
							{
								add.verified_seller = result.verified_seller;
							}
							//generting token
							jwtSign(add, "creation").then((c_token) => {
								return res.json({
									status: true,
									seller:add.verified_seller,
									token: c_token,
									message: "login  Sucessfully!"
								});
							}).catch((c_err) => {
								return res.status(400).json({
									error: true,
									err_message:c_err,
									message: "Something went wrong"
								});
							});
						}
						//check of password sucess
						if (c_err || c_sucess == false) {
							return res.status(400).json({
								error: true,
								message: "Your password is Invalid!.."
							});
						}
					});
				}
				else {
					return res.status(400).json({
						error: true,
						err: err,
						message: "Login failed",
						status: 400
					});
				}
			});
		}
		else {
			return res.status(400).json({
				error: true,
				message: "Please fill all the fields"
			});
		}
	}
	//checking if it is login through google process 
	else if(req.body.type === "google")
	{
		if(req.body.google_id!="" && req.body.email!= "" && req.body.name != "")
		{
			user.findOne({google_id:req.body.google_id},function(err,result){
				if(result)
				{
					let add = {
						_id:result._id,
						google_id:result.google_id,
						email:result.email,
						name:result.name
					};
					jwtSign(add,"creation").then(g_token=>{
						return res.json({
							sucess:true,
							token:g_token,
							message:"sucessfully login"
						});
					}).catch(err=>{
						return res.status(400).json({
							error:true,
							err:err,
							message:"Something went wrong"
						});
					});
				}
				else if(err)
				{
					return res.status(400).json({
						error:true,
						err:err,
						message:"Something went wrong"
					});
				}
				else
				{
					user.create({google_id:req.body.google_id,name:req.body.name,email:req.body.email},function(err,result){
						if(result)
						{
							let add = {
								_id:result._id,
								google_id:result.google_id,
								email:result.email,
								name:result.name
							};
							jwtSign(add,"creation").then(g_token=>{
								return res.json({
									sucess:true,
									token:g_token,
									message:"sucessfully login"
								});
							}).catch(g_err=>{
								return res.status(400).json({
									error:true,
									err:g_err,
									message:"Something went wrong"
								});
							});
						}
						else if(err)
						{
							return res.status(400).json({
								error:true,
								message:err
							});
						}
					});
				}
                
			});
		}
		else
		{
			return res.status(400).json({
				error:true,
				message:"Please give all the required fields"
			});
		}
	}
	//checking if it is login through facebook process 
	else if(req.body.type === "facebook")
	{
		if(req.body.facebook_id!="" && req.body.name != "")
		{   
			user.findOne({facebook_id:req.body.facebook_id},function(err,result){
				if(result)
				{
					let add = {
						_id:result._id,
						facebook_id:result.facebook_id,
						name:result.name
					};
					jwtSign(add,"creation").then(f_token=>{
						return res.json({
							sucess:true,
							token:f_token,
							message:"sucessfully login"
						});
					}).catch(err=>{
						return res.status(400).json({
							error:true,
							err:err,
							message:"Something went wrong"
						});
					});
				}
				else if(err)
				{
					return res.status(400).json({
						error:true,
						err:err,
						message:"Something went wrong"
					});
				}
				else 
				{
					user.create({facebook_id:req.body.facebook_id,name:req.body.name,email:`${req.body.name.split(" ")[0]}${Date.now()}@gmail.com`},function(err,result){
						if(result)
						{
							let add = {
								_id:result._id,
								facebook_id:result.facebook_id,
								name:result.name
							};
							jwtSign(add,"creation").then(f_token=>{
								return res.json({
									sucess:true,
									token:f_token,
									message:"sucessfully login"
								});
							}).catch(err=>{
								return res.status(400).json({
									error:true,
									err:err,
									message:"Something went wrong"
								});
							});
						}
						else if(err)
						{   
							return res.status(400).json({
								error:true,
								message:"Error while login with facebook"
							});
						}
						else
						{
							return res.status(400).json({
								error:true,
								message:"Check your data"
							});
						}
					});
				}
			});
		}
		else
		{
			return res.status(400).json({
				error:true,
				message:"Please give all the required fields"
			});
		}
	}
	else
	{
		res.status(400).json({
			error:true,
			message:"Please define the type of login"
		});
	}
});
//become a seller
app.post("/seller", upload.any(), middleware.isloggedin, function (req, res) {
	var token = req.headers.authorization.split(" ")[1];
	//checking if this data is entered
	if (req.files && req.body.street_name && req.body.city && req.body.state && req.body.pin) {
		var j = 0;
		//empty data object
		let data = {};

		//loop for images requied total three images and store them into data object 
		for (let i = 0; i < (req.files).length; i++) {
			if (req.files[i].fieldname === "pan_Image") {
				j = j + 1;
				data.Pan_Image = req.files[i].location;
			}
			else if (req.files[i].fieldname === "adhaar_front") {
				j = j + 1;
				data.Adhaar_front = req.files[i].location;
			}
			else if (req.files[i].fieldname === "adhaar_back") {
				j = j + 1;
				data.Adhaar_back = req.files[i].path;
			}
			else if (req.files[i].fieldname === "image") {
				data.image = req.files[i].location;
			}
		}
		//check if "j" length is less than 3 
		if (j < 3) {
			return res.status(400).json({
				error: true,
				message: "Please add all the images"
			});
		}
		//checking pan_card length
		else if ((req.body.pan_card).length != 10) {
			return res.status(400).json({
				error: true,
				message: "Pan card number must be 10"
			});
		}
		//checking adhaar card length
		else if (req.body.adhaar_card.toString().length != 12) {
			return res.status(400).json({
				error: true,
				message: "Adhaar card number must have 12 digits"
			});
		}
		else {
			//create address object for storing seller address
			let address = {
				street_name: req.body.street_name,
				city: req.body.city,
				state: req.body.state,
				Pin: req.body.pin
			};
			//create adhaar object for storing seller adhaar card info
			let adhaar = {
				card_no: req.body.adhaar_card,
				Image_front: data.Adhaar_front,
				Image_back: data.Adhaar_back
			};
			//create pan object for storing seller pan info
			let pan = {
				card_no: req.body.pan_card,
				Image: data.Pan_Image
			};
			if (data.image) {
				jwtVerify(token, "creation").then(tokenv => {
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
							});
						}
						if (err) {
							return res.status(400).json({
								error: true,
								message: "Error while uploading data"
							});
						}
					});

				}).catch(err => {
					return res.status(400).json({
						error: true,
						err_message:err,
						message: "Something went wrong"
					});
				});
			}
			else {
				jwtVerify(token, "creation").then(tokenv => {
					seller.updateOne({ _id: tokenv._id }, {
						Pancard_info: pan,
						Adhaar_info: adhaar,
						Address: address
					}, function (err, result) {
						if (result) {
							return res.json({
								sucess: true,
								message: "Your data is uploaded"
							});
						}
						if (err) {
							return res.status(400).json({
								error: true,
								message: "Error while uploading data"
							});
						}
					});

				}).catch(err => {
					return res.status(400).json({
						error: true,
						err_message:err,
						message: "Something went wrong"
					});
				});
			}
		}
	}
	//checking if this data is entered
	else if (req.body.account_number && req.body.account_holder_name && req.body.ifse && req.body.bank_name) {
		//check length must be of 10 digit
		if (req.body.account_number.toString().length < 10) {
			return res.status(400).json({
				error: true,
				message: "Account nummber should be greater then or equal to 10"
			});
		}
		//check the length of account_holder_name
		else if ((req.body.account_holder_name).length < 5) {
			return res.status(400).json({
				error: true,
				message: "Length is too short for holder_name"
			});
		}
		//check length of ifse
		else if ((req.body.ifse).length != 11) {
			return res.status(400).json({
				error: true,
				message: "Length for IFSE code should be 11 "
			});
		}
		else {
			//create bank object for storing bank detail
			var bank = {
				Account_number: req.body.account_number,
				A_holder_name: req.body.account_holder_name,
				IFSE_code: req.body.ifse,
				Bank_name: req.body.bank_name
			};

			jwtVerify(token, "creation").then(tokenv => {
				seller.updateOne({ _id: tokenv._id }, { Bank_details: bank }, function (err, result) {
					if (result) {
						return res.json({
							sucess: true,
							message: "Your bank details are added"
						});
					}
					if (err) {
						return res.status(400).json({
							error: true,
							message: "Error while uploading bank data"
						});
					}

				});
			}).catch(err => {
				return res.status(400).json({
					error: true,
					message: "Something went wromg"
				});
			});
		}

	}
	//checking if this data is entered
	else if (req.body.bio) {
		jwtVerify(token, "creation").then(tokenv => {
			seller.updateOne({ _id: tokenv._id }, { bio: req.body.bio, verified_seller: true }, function (err, result) {
				if (result) {
					return res.json({
						status: 200,
						message: "Bio is registered"
					});
				}
				if (err) {
					return res.status(400).json({
						message: "Error while registering bio"
					});
				}
			});
		}).catch(err => {
			return res.status(400).json({
				message: "something went wrong"
			});
		});

	}
	//checking if this data is entered
	else if (req.body.delivery_option) {
		jwtVerify(token, "creation").then(tokenv => {
			let option = [];
			let j=0,k=0;
			for(let i=0;i<req.body.delivery_option.length;i++)
			{
				if(req.body.delivery_option[i]==="delivery")
				{
					if(j==0)
					{
						option.push(req.body.delivery_option[i]);
						j++;
					}
					else
					{
						return res.status(400).json({
							error:true,
							message:"please don't add same data"
						});
					}
				}
				else if(req.body.delivery_option[i]==="pickup_only")
				{
					if(k==0)
					{
						option.push(req.body.delivery_option[i]);
						k++;
					}
					else
					{
						return res.status(400).json({
							error:true,
							message:"please don't add same data"
						});
					}
				}
				else
				{
					return res.status(400).json({
						error:true,
						message:"Please only enter delivery OR pickup_only OR both in array"
					});
				}
			}
			seller.findOneAndUpdate({ _id: tokenv._id }, { Delivery_options: option }, { new: true, runValidators: true }, function (err, result) {
				if (result) {
					return res.json({
						sucess: true,
						message: "Delivery option registered"
					});
				}
				if (err) {
					return res.status(400).json({
						error: true,
						err: err.message,
						message: "Error while registering "
					});
				}
			});

		}).catch(err => {
			return res.status(400).json({
				error: true,
				err:err,
				message: "Something went wrong"
			});
		});
	}

});
//Viewing delivery_option for seller
app.get("/view_delivery-option",middleware.isloggedin,function(req,res){
	var token = req.headers.authorization.split(" ")[1];
	jwtVerify(token,"creation").then(tokenv=>{
		//finding seller
		seller.findOne({_id:tokenv._id},function(error,result){
			if(result)
			{
				return res.json({
					sucess:true,
					delivery_option:result.Delivery_options
				});
			}
			else
			{
				return res.status(400).json({
					error:true,
					message:"error while fetching delivery_option"
				});
			}
		});
	});
});
//set schedule for seller
app.post("/schedule", middleware.isloggedin, function (req, res) {
	var token = req.headers.authorization.split(" ")[1];
	//check all fields are entered
	if (req.body.date && req.body.start && req.body.end) {
		//schedule object for storing data
		let schedule = {
			Date: req.body.date,
			start_time: req.body.start,
			end_time: req.body.end
		};
		jwtVerify(token, "creation").then(tokenv => {
			//find and update new schedule entered
			seller.findOneAndUpdate({ _id: tokenv._id }, { schedule: schedule }, function (err, result) {
				if (result) {
					return res.json({
						status: true,
						message: "Your schedule is stored"
					});
				}
				if (err) {
					return res.status(400).json({
						error: true,
						message: "Error while scheduling.."
					});
				}
			});
		}).catch(err => {
			return res.status(400).json({
				error: true,
				err_message:err,
				message: "Something went wrong"
			});
		});
	}
	else {
		return res.status(400).json({
			error: true,
			message: "fill all the fields"
		});
	}
});
//viewing time schedule
app.get("/view_schedule",middleware.isloggedin,function(req,res){
	var token = req.headers.authorization.split(" ")[1];
	jwtVerify(token,"creation").then(tokenv=>{
		seller.findOne({_id:tokenv._id},function(error,result){
			if(result)
			{
				return res.json({
					sucess:true,
					delivery_option:result.schedule
				});
			}
			else
			{
				return res.status(400).json({
					error:true,
					message:"error while fetching delivery_option"
				});
			}
		});
	});
});
//default home page
app.get("/",(req,res)=>{
	res.send("hellow");
});
//3 API's for forget 
var valid = 0;
app.post("/forget", function (req, res) {
	//check the email format
	if(/^[a-zA-Z0-9\.]+[@][a-z]+[\.][a-z]{2,3}$/.test(req.body.email) == false && req.body.email) {
		return res.status(400).json({
			error: true,
			message: "Please check your mail is not in format"
		});
	}
	//adding info of user
	var transporter = nodemailer.createTransport({
		host: "smtp.mailtrap.io",
		port: 2525,
		auth: {
			user: "596caf575abd7f",
			pass: "739f87e138ed54"
		}
	});
	//creating URL 
	let url = "<a href=\"http://" + req.headers.host + "/forget-reset-password/" + req.body.email + "\">http://" + req.headers.host + "/reset-password/" + req.body.email + "</a>";
	//sending format
	let info = transporter.sendMail({
		from: "CIBO@gmail.com", // sender address
		to: req.body.email, // list of receivers
		subject: "CIBO Reset password ", // Subject line
		text: "Hello world?", // plain text body
		html: "<p>We just acknowledged that you have requested to change your account password. You can change your password by clicking on the link below.</p>" + url + "<p>If you did not make this request. Please ignore this email.</p>" // html body
	});
	return res.json({
		sucess: true,
		message: "Link send to your email"
	});
});
app.get("/forget-reset-password/:email", function (req, res) {
	//render the ejs templete
	res.render("reset", { email: req.params.email });
	valid = 1;
});
app.post("/forget-response/:email", function (req, res) {
	//check the new password
	if (req.body.New_password != req.body.confirm_password) {
		return res.status(400).json({
			error: true,
			message: "your Passwords are not matched"
		});
	}
	//checking the length password
	else if ((req.body.New_password).length < 6) {
		return res.status(400).json({
			error: true,
			message: "Password length should be 6 or more"
		});
	}
	//check if it is empty
	else if (req.body.New_password == "" && req.boy.confirm_password == "" || req.body.New_password == "" || req.body.confirm_password == "") {
		return res.status(400).json({
			error: true,
			message: "Please fill all the fields"
		});
	}
	else {
		//making encrypted data
		bcrypt.hash(req.body.New_password, saltRounds, function (b_err, b_result) {
			if (b_result && valid) {
				user.updateOne({ email: req.params.email }, { password: b_result }).then(result => {
					valid = 0;
					return res.json({
						sucess: true,
						message: "Your password is now change"
					});
				}).catch(err => {
					return res.status(400).json({
						error: err,
						message: "Error while changing password"
					});
				});
			}
			else if (!valid) {
				return res.status(400).json({
					error: true,
					message: "Something went wrong"
				});
			}
			if (b_err) {
				return res.status(400).json({
					error: err,
					message: "Something went wrong"
				});
			}
		});

	}

});
//favorites
app.post("/favorite", middleware.isloggedin, function (req, res) {
	var token = req.headers.authorization.split(" ")[1];
	//checking if it is empty
	if (req.body.seller_id == "" || req.body.item_id == "" || req.body.like_status === "") {
		return res.status(400).json({
			error: true,
			message: "Please fill all the blanks"
		});
	}
	else {
		jwtVerify(token, "creation").then(tokenv => {
			//favorite findOne
			favorite.findOne({ user_id: tokenv._id, item_id: req.body.item_id }, function (err, result) {
				//checking if is not same
				if (tokenv._id != req.body.seller_id) {
					//change status to like_status
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
					}//check like_status is true
					else if (req.body.like_status === true) {
						let data = {
							seller_id: req.body.seller_id,
							user_id: tokenv._id,
							item_id: req.body.item_id,
							like_status: req.body.like_status
						};
						//add to favorite
						favorite.create(data, function (err, result) {
							if (result) {
								return res.json({
									sucess: true,
									message: "You favorite this item"
								});
							}
							if (err) {
								return res.status(400).json({
									error: true,
									message: "Error while favorite this item"
								});
							}
						});
					}
					//checking like_status is false
					else if (req.body.like_status === false) {
						favorite.deleteOne({ user_id: tokenv._id, item_id: req.body.item_id }, function (err, result) {
							if (result && result.deletedCount) {
								return res.json({
									sucess: true,
									message: "This item removed sucessfully from your Favorite list"
								});
							}
							else {
								return res.status(400).json({
									error: true,
									message: "Something went wrong"
								});
							}
						});
					}
					else {
						return res.status(400).json({
							error: true,
							message: "Something went wrong"
						});
					}
				}
				else
				{
					return res.status(400).json({
						error: true,
						message: "Something went wrong"
					});
				}
			});
		}).catch(err => {
			return res.status(400).json({
				error: true,
				err_message:err,
				message: "Something went wrong"
			});
		});
	}
});
//viewing users-favorite
app.get("/view-favorite",middleware.isloggedin,function(req,res){
	var token = req.headers.authorization.split(" ")[1];
	jwtVerify(token, "creation").then(tokenv => {
		//find user data
		user.findOne({ _id: tokenv._id }, function (err, result) {
			if(result){
				//aggregate for getting item dataa
				item.aggregate([
					{
						//lookup on favorite
						$lookup:{
							from:"favorites",
							let:{i_id:"$_id"},
							//pipeline for matching the data inside favorite
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
					//lookup on user to get user data
					{
						$lookup:{
							from:"users",
							let:{sellerid:"$seller_id"},
							//pipeline for getting user data and its distance is not greater than 5KM
							pipeline:[
								{
									//adding geonear for getting distance
									$geoNear:{
										near: { type: "point", coordinates: [result.long, result.lat] },
										distanceField: "dist.calculated",
										maxDistance: 500 * 1000,
										distanceMultiplier: 1 / 1000,
										spherical: true
									}
								},
								//matching the seller_id
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
							as:"seller"
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
							"distance":{$round:["$seller.dist.calculated",2]}
						}
					}
        
				],function(error,data){
					if(data)
					{
						return res.json({
							sucess:true,
							result:data
						});
					}
					if(error)
					{
						return res.status(400).json({
							error:true,
							Message:error
						});
					}
				});
			}
		});
	}).catch(err=>{
		return res.status(400).json({
			error:true,
			err_message:err,
			message:"Something went wrong"
		});
	});
    
});
//blogs
app.post("/blog", upload.any(), middleware.isloggedin, function (req, res) {
	var token = req.headers.authorization.split(" ")[1];
	//verify token
	jwtVerify(token, "creation").then(tokenv => {
		//create data object for storing data
		let data = {
			user_id: tokenv._id,
			image: req.files[0].location,
			title: req.body.title,
			desc: req.body.description
		};
		//Insert new blog
		blogs.create(data, function (err, result) {
			if (result) {
				return res.json({
					sucess: true,
					message: "Your blog is stored sucessfully"
				});
			}
			if (err) {
				return res.status(400).json({
					error: true,
					message: "Error in blogs"
				});
			}
		});
	}).catch(err => {
		return res.status(400).json({
			error: true,
			err: err,
			message: "Something went wrong"
		});
	});

});
//view-blogs
app.get("/get-blogs",middleware.isloggedin,function(req,res){
	var token = req.headers.authorization.split(" ")[1];
	//verify token
	jwtVerify(token,"creation").then(tokenv=>{
		//aggregation on blog for matching and getting info of user
		blogs.aggregate([
			{
				$match:{
					user_id:mongoose.Types.ObjectId(tokenv._id)
				}
			},
			//getting info from user
			{
				$lookup:{
					from:"users",
					localField:"user_id",
					foreignField:"_id",
					as:"user"
				}
			},
			//unwind for taking array outside the brackets
			{
				$unwind:"$user"
			},
			{
				$project:{
					"image":1,
					"title":1,
					"desc":1,
					"date":1,
					"user_name":"$user.name"
				}
			}
		],function(err,result){
			if(result)
			{
				return res.json({
					sucess:true,
					data:result,
					message:"Data fetched sucessfully"
				});
			}
			else
			{
				return res.status(400).json({
					error:true,
					err_message:err,
					message:"Error while data"
				});
			}
		});
	});
});
//seller blogs reviewed by user
app.get("/get-blogs-of-seller/:seller_id",middleware.isloggedin,function(req,res){
	var token = req.headers.authorization.split(" ")[1];
	//verify token
	jwtVerify(token,"creation").then(tokenv=>{
		//getting seller blogs
		blogs.aggregate([
			{
				//matching seller_id with stored _id
				$match:{
					user_id:mongoose.Types.ObjectId(req.params.seller_id)
				}
			},
			//lookup on user for getting user information
			{
				$lookup:{
					from:"users",
					localField:"user_id",
					foreignField:"_id",
					as:"user"
				}
			},
			//unwind user data
			{
				$unwind:"$user"
			},
			{
				$project:{
					"image":1,
					"title":1,
					"desc":1,
					"date":1,
					"user_name":"$user.name"
				}
			}
		],function(err,result){
			if(result)
			{
				return res.json({
					sucess:true,
					data:result,
					message:"Data fetched sucessfully"
				});
			}
			else
			{
				return res.status(400).json({
					error:true,
					err_message:err,
					message:"Error while data"
				});
			}
		});
	});
});
//storing items by seller
app.post("/items", upload.any(), middleware.isloggedin, function (req, res) {
	var token = req.headers.authorization.split(" ")[1];
	//check for add item operation
	if(req.body.operation === "add"){
		//checking item_name length 
		if (req.body.item_name.length < 6) {
			return res.status(400).json({
				error: true,
				message: "Item name is too short"
			});
		}
		else {
			//check if this data is available
			if(req.files && req.body.item_name && req.body.category && req.body.price && req.body.description)
			{
				//verify token
				jwtVerify(token, "creation").then(tokenv => {
					//finding seller
					seller.findOne({_id: tokenv._id}, function (err, result) {
						//check if this verified seller
						if (result.verified_seller) {
							//create data object
							let data = {
								seller_id: tokenv._id,
								i_image: req.files[0].location,
								item_name: req.body.item_name,
								category: req.body.category,
								price: req.body.price,
								description: req.body.description,
								special_notes: req.body.special_notes
							};
							//create data in item
							item.create(data, function (err, result) {
								if (result) {
									return res.json({
										status: true,
										message: "Your item is added"
									});
								}
								if (err) {
									return res.status(400).json({
										error: true,
										err: err,
										message: "Error while adding"
									});
								}
							});
						}
						else if (err) {
							return res.status(400).json({
								error: true,
								message: "Something went wrong"
							});
						}
						else {
							return res.status(400).json({
								error: true,
								message: "May be you are not a valid seller"
							});
						}
					});
				}).catch(err => {
					return res.status(400).json({
						err:err,
						message: "Something went wrong"
					});
				});
			}
			else
			{
				return res.status(400).json({
					error:true,
					message:"Please fill all the blanks"
				});
			}
		}
	}
	//check for status change operation
	else if(req.body.operation === "status")
	{
		//check for item_id
		if(req.body.item_id)
		{
			//verify token
			jwtVerify(token,"creation").then(tokenv=>{
				//find the item in item collection
				item.findOne({_id:req.body.item_id,seller_id:tokenv._id},function(err,result){
					//check for result
					if(result)
					{
						//check for item is active or not 
						if(result.i_active === "true")
						{
							//update the status of item of the item
							item.findOneAndUpdate({_id:req.body.item_id},{i_active:"false"},function(u_err,u_result){
								if(u_result)
								{
									return res.json({
										sucess:true,
										message:"Operation sucessfull -> status change"
									});
								}
								else
								{
									return res.status(400).json({
										error:true,
										err:u_err,
										message:"Something went wrong"
									});
								}
							});
						}
						//check if this item is false
						else if(result.i_active === "false")
						{
							//update the item active to true
							item.findOneAndUpdate({_id:req.body.item_id},{i_active:"true"},function(u_err,u_result){
								if(u_result)
								{
									return res.json({
										sucess:true,
										message:"Operation sucessfull -> status change"
									});
								}
								else
								{
									return res.status(400).json({
										error:true,
										err:u_err,
										message:"Something went wrong"
									});
								}
							});
						}
					}
					else
					{
						return res.status(400).json({
							error:true,
							message:"Error in item while changing status"
						});
					}
				});
			}).catch(err=>{
				return res.status(400).json({
					error:true,
					err_message:err,
					message:"Something went wrong"
				});
			});
		}
		else
		{
			return res.status(400).json({
				error:true,
				message:"Provide all the data"
			});
		}
	}
	//check for edit item operation
	else if(req.body.operation === "edit")
	{
		//verify token
		jwtVerify(token,"creation").then(tokenv=>{
			//check the available fields
			if(req.files.length && req.body.item_name && req.body.category && req.body.price && req.body.description){
				//store data in data object
				let data = {
					i_image:req.files[0].location,
					item_name:req.body.item_name,
					category:req.body.category,
					price:req.body.price,
					description:req.body.description,
					special_notes:req.body.special_notes
				};
				//update the information
				item.updateOne({_id:req.body.item_id,seller_id:tokenv._id},data,function(u_err,u_result){
					if(u_result)
					{
						return res.json({
							sucess:true,
							message:"Your item data is sucessfully updated..."
						});
					}
					else
					{
						return res.status(400).json({
							error:true,
							err:u_err,
							message:"Something went wrong"
						});
					}
				});  
			}
			//check the available fields
			else if(!req.files.length && req.body.item_name && req.body.category && req.body.price && req.body.description)
			{
				let data = {
					item_name:req.body.item_name,
					category:req.body.category,
					price:req.body.price,
					description:req.body.description,
					special_notes:req.body.special_notes
				};
				item.updateOne({_id:req.body.item_id,seller_id:tokenv._id},data,function(u_err,u_result){
					if(u_result && u_result.nModified)
					{
						return res.json({
							sucess:true,
							message:"Your item data is sucessfully updated..."
						});
					}
					else if(u_result.nModified === 0)
					{
						return res.status(400).json({
							error:true,
							message:"Please do some update on your data"
						}); 
					}
					else
					{
						return res.status(400).json({
							error:true,
							err:u_err,
							message:"Something went wrong"
						});
					}
				});  
			}
			else
			{
				return res.status(400).json({
					error:true,
					message:"Please fill all the fields"
				});
			}
		}).catch(err=>{
			return res.status(400).json({
				error:true,
				err:err,
				message:"Something went wrong"
			});
		});
	}
	//check for delete item operation
	else if(req.body.operation === "delete")
	{
		//verify token
		jwtVerify(token,"creation").then(tokenv=>{
			//check the item_id is available
			if(req.body.item_id)
			{
				//query for deleting the item
				item.deleteOne({_id:req.body.item_id,seller_id:tokenv._id},function(d_err,d_result){
					if(d_result && d_result.n)
					{
						//favorite item aslo delete
						favorite.deleteOne({item_id:req.body.item_id},function(f_err,f_result){
							console.log("result=>",f_result);
							if(f_result && f_result.n)
							{
								return res.json({
									sucess:true,
									message:"Your item is sucessfully deleted"
								});   
							}
							else if(f_result.n === 0)
							{
								return res.json({
									sucess:true,
									message:"Your item is sucessfully deleted"
								}); 
							}
							else
							{
								return res.status(400).json({
									error:true,
									err:f_err,
									message:"Error while deleting from favorites"
								});
							}
						});
					}
					else
					{
						return res.status(400).json({
							error:true,
							err:d_err,
							message:"Error while deleting the item "

						});
					}
				});
			}
			else
			{
				return res.status(400).json({
					error:true,
					message:"Please provide all the information"
				});
			}
		}).catch(err=>{
			return res.status(200).json({
				error:true,
				err:err,
				message:"Something went wrong"
			});  
		});
	}
	//if all condition fails
	else
	{
		return res.status(400).json({
			error:true,
			message:"Please specify the operation you perform"
		});
	}
});
//List view of item by seller
app.get("/listed-item",middleware.isloggedin,function(req,res){ 
	var token = req.headers.authorization.split(" ")[1];
	//verify token
	jwtVerify(token,"creation").then(tokenv=>{
		//aggregate on item 
		item.aggregate([
			{
				//match used matching seller_id and token id in item
				$match:{
					seller_id:mongoose.Types.ObjectId(tokenv._id)
				}
			},
			{
				$project:{
					item_name:1,
					i_image:1,
					category:1,
					price:1,
					special_notes:1,
					i_active:1,
					description:1
				}
			}
		],function(err,result){
			if(result)
			{
				return res.json({
					sucess:true,
					data:result,
					message:"data fetched sucessfully"
				});
			}
			else
			{
				return res.status(400).json({
					error:true,
					err:err,
					messahe:"Error while fetching data"
				});
			}
		});
	});
});
//list viewed by buyer
app.get("/listed-item-of-seller/:seller_id",middleware.isloggedin,function(req,res){ 
	var token = req.headers.authorization.split(" ")[1];
	//verify token
	jwtVerify(token,"creation").then(tokenv=>{
		//aggregate on item
		item.aggregate([
			{
				//match for item is active
				$match:{
					i_active:"true"
				}
			},
			//match seller_id in item
			{
				$match:{
					seller_id:mongoose.Types.ObjectId(req.params.seller_id)
				}
			},
			{
				$project:{
					item_name:1,
					i_image:1,
					category:1,
					price:1,
					special_notes:1,
					description:1
				}
			}
		],function(err,result){
			if(result)
			{
				return res.json({
					sucess:true,
					data:result,
					message:"data fetched sucessfully"
				});
			}
			else
			{
				return res.status(400).json({
					error:true,
					err:err,
					messahe:"Error while fetching data"
				});
			}
		});
	});
});
//adding item to add_to_cart
app.post("/addToCart",middleware.isloggedin,function(req,res){
	var token = req.headers.authorization.split(" ")[1];
	//verify token
	jwtVerify(token,"creation").then(tokenv=>{
		//checking if this item is available
		if(req.body.item_id && req.body.quantity && req.body.order_type && req.body.seller_id)
		{
			//finding the data addtoCart
			addToCart.findOne({user_id:tokenv._id,item_id:req.body.item_id},function(a_err,a_result){
				//check if item is already in cart
				if(a_result)
				{
					return res.status(400).json({
						error:true,
						message:"Your selected item already present in your cart "
					});
				}
				else if(a_err)
				{
					return res.status(400).json({
						error:true,
						err:a_err,
						message:"Your selected item already present in your cart "
					});
				}  
				else
				{
					//finding item in item collection
					item.findOne({_id:req.body.item_id},function(i_err,i_result){
						if(i_result)
						{ 
							//calculate total price
							var cal_price = i_result.price * req.body.quantity;
							//data object
							let data = {
								item_id:req.body.item_id,
								quantity:req.body.quantity,
								order_type:req.body.order_type,
								user_id:tokenv._id,
								price:cal_price,
								item_image:i_result.i_image,
								item_name:i_result.item_name,
								seller_id:req.body.seller_id
							};
							//special instruction
							if(req.body.special_instruction)
							{
								data.special_i = req.body.special_instruction;
							}
							//finding user in addtocart 
							addToCart.findOne({user_id:tokenv._id},function(a1_err,a2_result){
								if(a2_result)
								{
									//matching seller_id's
									if(a2_result.seller_id == req.body.seller_id)
									{
										//insert data to addcart
										addToCart.create(data,function(a2_err,a2_result){
											if(a2_result)
											{
												return res.json({
													sucess:true,
													message:"Your item added in your cart"
												});
											}
											else
											{
												return res.status(400).json({
													error:true,
													message:"error entered"
												});
											}
										});   
									}
									else
									{
										return res.status(400).json({
											error:true,
											message:"Please add item from one seller"
										});
									}
								}
								else if(a1_err)
								{
									return res.status(400).json({
										error:true,
										message:"Something went wrong"
									});
								}
								else
								{
									//adding data into addTocart
									addToCart.create(data,function(a2_err,a2_result){
										if(a2_result)
										{
											return res.json({
												sucess:true,
												message:"Your item added in your cart"
											});
										}
										else
										{
											return res.status(400).json({
												error:true,
												err:a2_err,
												message:"error entered"
											});
										}
									});
								}
							});
						}
						else
						{
							return res.status(400).json({
								error:true,
								err:i_err,
								message:"Your item_id not found"
							});
						}
					});
				}
			});
		}
		else
		{
			return res.status(400).json({
				error:true,
				message:"Please give all the required fields..."
			});
		}
	});
});
//viewing item in cart
app.get("/ViewaddToCart",middleware.isloggedin,function(req,res){
	var token = req.headers.authorization.split(" ")[1];
	//verify token
	jwtVerify(token,"creation").then(tokenv=>{
		//find user 
		user.findOne({_id:tokenv._id},function(err,result){
			if(result)
			{
				//aggregate on addtocart for getting data
				addToCart.aggregate([
					//sort in descending order
					{
						$sort:{ "date": -1 }
					},
					//matching user_id with id
					{
						$match:{
							user_id:mongoose.Types.ObjectId(result._id)
						}   
					},
					//lookup on item getting item information
					{
						$lookup:{
							from:"items",
							let:{itemid:"$item_id"},
							pipeline:[
								{
									$match:{
										$expr:{
											$and:[
												{$eq:["$$itemid","$_id"]}
											]
										}
									}
								},
                                
							],
							as: "item"
						}
					},
					//unwind on item 
					{
						$unwind:"$item"
					},
					{
						$project:{
							item_id:"$item._id",
							i_image:"$item.i_image",
							i_name:"$item.item_name",
							price:1,
							quantity:1,
							special_i:1,
							order_type:1
						}
					}
                    
				],function(err1,result1){
					if(result1) 
					{
						var sum=0;
						for(let i=0;i<result1.length;i++)
							sum = sum+result1[i].price;
						return res.json({
							sucess:true,
							message:result1,
							total_pay:sum,
							latitude:result.lat,
							longitude:result.long,
							delivery_address:result.delivery_address
						});
					}
					else
					{
						return res.status(400).json({
							error:true,
							err:err1,
							message:"Error while fetching add_to_cart"
						});
					}
				});
			}
			else
			{
				return res.status(400).json({
					error:true,
					err:err,
					message:"User not found from token"
				});
			}
		});
	});
});
//deleting items in addToCart
app.delete("/delete_addToCart/:item_id",middleware.isloggedin,function(req,res){
	var token = req.headers.authorization.split(" ")[1];
	//verify token
	jwtVerify(token,"creation").then(tokenv=>{
		//delete the item in addtoCart
		addToCart.deleteOne({user_id:tokenv._id,item_id:req.params.item_id},function(err,result){
			if(result && result.n)
			{   
				return res.json({
					sucess:true,
					message:"your item in cart is deleted!!"
				});
			}
			else
			{
				return res.status(400).json({
					error:true,
					message:"error while delete in cart"
				});
			}
		});  
	});
});
//addToCart to orders
app.post("/add_to_order",middleware.isloggedin,function(req,res){
	var token = req.headers.authorization.split(" ")[1];
	//verify token
	jwtVerify(token,"creation").then(tokenv=>{
		//find user in collection
		user.findOne({_id:tokenv._id},function(err,result){
			if(result)
			{
				//find user in addtocart
				addToCart.find({user_id:tokenv._id},function(err1,result1){
					if(result1 && result1.length)
					{   
						//empty collector
						var collector = [];
						//empty collect1
						var collect1 = {};
						//loop on result
						for(let i=0;i<result1.length;i++)
						{

							collect1.item_id = mongoose.Types.ObjectId(result1[i].item_id);
							collect1.quantity = result1[i].quantity;
							collect1.item_image = result1[i].item_image;
							collect1.item_name = result1[i].item_name;
							collect1.special_i = result1[i].special_i;
							collect1.price = result1[i].price;
							collector.push(collect1);
							collect1 = {};
						}
						//generate order Number
						var order_number = otpGenerator.generate(9, { digits: true, alphabets: false, upperCase: false, specialChars: false });
						//data object for storing data for order
						let data = {
							all_item:collector,
							user_id:tokenv._id,
							delivery_time:req.body.delivery_time,
							delivery_address:result.delivery_address,
							order_type:result1[0].order_type,
							seller_id:result1[0].seller_id,
							payment_method:req.body.payment_method,
							order_number:order_number
						};
						//insert data to order collection
						order.create(data,function(o_err,o_result){
							if(o_result)
							{
								//delete data in addtocart
								addToCart.deleteMany({user_id:tokenv._id},function(d_err,d_result){
									if(d_result)
									{
										return res.json({
											sucess:true,
											message:"Your order has been placed!!..please wait for order_status change by seller"
										});
									}
									else
									{
										return res.status(400).json({
											sucess:true,
											err:d_err,
											message:"Error while placing order0"
										});
									}
								});
                                
							}
							else
							{
								return res.status(400).json({
									error:true,
									err:o_err,
									message:"Eror while placing orders1"
								});
							}
						});
					}
					else if(err1){
						return res.status(400).json({
							error:true,
							err:err1,
							message:"Something went wrong"  
						});
					}
					else
					{
						return res.status(400).json({
							error:true,
							message:"No data found in your Cart"
						});
					}
				});
			}
			else
			{
				return res.status(400).json({
					error:true,
					err:err,
					message:"User not found!!.."
				});
			}
		});
	});
});
//views_MY_order 
app.get("/My_order",middleware.isloggedin,function(req,res){
	var token = req.headers.authorization.split(" ")[1];
	//verify token
	jwtVerify(token,"creation").then(tokenv=>{
		//aggregate on order for getting data
		order.aggregate([
			//sort the data in descending order
			{
				$sort:{"date":-1}
			},
			//match user_id with token_id
			{
				$match:{
					user_id:mongoose.Types.ObjectId(tokenv._id)
				}
			},
			//addfield create for taking first element
			{ $addFields: { firstitem: { $first: "$all_item" } } },
			//loookup on item
			{
				$lookup:{
					from:"items",
					let: { itemid:"$firstitem.item_id"},
					//pipeline matching data
					pipeline:[
						{
							//match the item_id
							$match:{
								$expr:{
									$and:[
										{$eq:["$$itemid","$_id"]}
									]
								}
							}
						},
						//lookup on user collection for user data
						{
							$lookup:{
								from:"users",
								let:{sellerid:"$seller_id"},
								pipeline:[
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
								as:"seller"
							}
                            
						},
						{
							$unwind:"$seller"
						}
					],
					as:"item"
				}
			},
			//unwind item data
			{
				$unwind:"$item"
			},
			//lookup on reviews for getting reviews
			{
				$lookup:{
					from:"reviews",
					let:{orderId:"$_id"},
					pipeline:[
						{
							$match:{
								$expr:{
									$and:[
										{$eq:["$user_id",mongoose.Types.ObjectId(tokenv._id)]},
										{$eq:["$$orderId","$order_id"]}
									]
								}
							}
						}
					],
					as:"reviews"
				}
			},
			{
				$unwind:{
					path:"$reviews",
					preserveNullAndEmptyArrays:true
				}
			},
			{
				$project:{
					"item_Image":"$item.i_image",
					"item_Name":"$item.item_name",
					"order_status":1,
					"date":1,
					"seller_id":1,
					"total_price":1,
					"order_number":1,   
					"reviews":"$reviews.star",
					"orderAmount":{$sum:"$all_item.price"},
					"seller_name":"$item.seller.name"
				}
			}
		],function(err,result){
			if(result && result.length)
			{
				return res.json({
					sucess:true,
					data:result
				});
			}
			else if(err)
			{
				return res.status(400).json({
					error:true,
					err:err,
					message:"Error while fetching data from orders"
				});
			}
			else
			{
				return res.status(200).json({
					sucess:true,
					data:result,
					message:"No data found"
				});
			}
		});
	});
});
//adding reviews
app.post("/review",middleware.isloggedin,function(req,res){
	var token = req.headers.authorization.split(" ")[1];
	//verify token
	jwtVerify(token,"creation").then(tokenv=>{
		//check if fields are available
		if(req.body.order_id && req.body.seller_id && req.body.star && req.body.message)
		{
			//find reviews on user
			review.findOne({user_id:tokenv._id,order_id:req.body.order_id},function(error,result){
				if(result)
				{
					return res.status(400).json({
						error:true,
						message:"Your review already registered!!!...."
					});
				}
				else if(error)
				{
					return res.status(400).json({
						error:true,
						error_message:error,
						message:"Error in review"

					});
				}
				else
				{
					let data = {
						user_id:tokenv._id,
						seller_id:req.body.seller_id,
						order_id:req.body.order_id,
						star:req.body.star,
						message:req.body.message
					};
					review.create(data,function(err1,result1){
						if(result1)
						{
							return res.json({
								success:true,
								message:"Your review is sucessfully registered"
							});
						}
						else
						{
							return res.status(400).json({
								error:true,
								err:err1,
								message:"Error while registering your review"
							});
						}
					});

				}
			});
		}
		else{
			return res.status(400).json({
				error:true,
				message:"Please fill the fields"
			});
		}
	}).catch(err=>{
		return res.status(400).json({
			error:true,
			err:err,
			message:"Something went wrong"
		});
	});
});
//getting reviews to seller
app.get("/get-reviews/:seller_id",middleware.isloggedin,function(req,res){
	var token = req.headers.authorization.split(" ")[1];
	//verify token
	jwtVerify(token,"creation").then(tokenv=>{
		//aggregate on reviews getting user data
		review.aggregate([
			//matching seller_id 
			{
				$match:{
					seller_id:mongoose.Types.ObjectId(req.params.seller_id)
				}
			},
			//lookup on user getting user details
			{
				$lookup:{
					from:"users",
					let:{userId:"$user_id"},
					pipeline:[
						{
							$match:{
								$expr:{
									$and:[
										{$eq:["$$userId","$_id"]}
									]
								}
							}
						}
					],
					as:"user"
				}
			},
			{
				$unwind:"$user"
			},
			{
				$project:{
					"user_image":"$user.image",
					"user_name":"$user.name",
					"star":1,
					"message":1
				}
			}
		],function(error,result){
			if(result)
			{
				return res.json({
					sucess:true,
					data:result
				});
			}
			else
			{
				return res.status(400).json({
					error:true,
					error_message:error,
					message:"Eror while fetching data"
				});
			}
		});
	});
});
//view particular order
app.get("/view_order/:order_id",middleware.isloggedin,function(req,res){
	var token = req.headers.authorization.split(" ")[1];
	//verify token
	jwtVerify(token,"creation").then(tokenv=>{
		//aggregate on order
		order.aggregate([
			{
				//matching order_id and token_id with order
				$match:{
					$expr:{
						$and:[
							{$eq:["$_id",mongoose.Types.ObjectId(req.params.order_id)]},
							{$eq:["$user_id",mongoose.Types.ObjectId(tokenv._id)]}
						]
					}
				},
               
			},
			//lookup on reviews
			{
				$lookup:{
					from:"reviews",
					let:{orderId:"$_id"},
					pipeline:[
						{
							$match:{
								$expr:{
									$and:[
										{$eq:["$user_id",mongoose.Types.ObjectId(tokenv._id)]},
										{$eq:["$$orderId","$order_id"]}
									]
								}
							}
						}
					],
					as:"reviews"
				}
			},
			{
				$unwind:{
					path:"$reviews",
					preserveNullAndEmptyArrays:true
				}
			},
			{
				$project:{
					all_item:1,
					order_number:1,
					delivery_address:1,
					order_status:1,
					payment_method:1,
					seller_id:1,
					"reviews":"$reviews.star",
					"Total_Pay":{$sum:"$all_item.price"}
				}
			}
		],function(err,result){
			if(result)
			{
				return res.json({
					sucess:true,
					data:result,
					message:"Data fetched sucessfully!...."
				});
			}
			else
			{
				return res.status(400).json({
					error:true,
					message:"Error while fetching data"
				});
			}
		});
	}).catch(err=>{
		return res.status(400).json({
			error:true,
			err:err,
			message:"Something went wrong"
		});
	});
});
//trending API
app.get("/trending/:option",middleware.isloggedin,function(req,res){
	var token = req.headers.authorization.split(" ")[1];
	//verify token
	jwtVerify(token,"creation").then(tokenv=>{
		//find user
		user.findOne({_id:tokenv._id},function(err1,result1){
			if(result1)
			{
				//check params option if it is delivery and pick_only
				if(req.params.option === "delivery" || req.params.option === "pickup_only")
				{
					//aggregate apply on item
					item.aggregate([
						{
							//lookup on user for getting user detail
							$lookup: {
								from: "users",
								let: { seller_id: "$seller_id",active:"$i_active"},
								//pipeline to get required data
								pipeline: [
									//apply geonear to get distance of around 5Km
									{
										$geoNear: {
											near: { type: "point", coordinates: [result1.long, result1.lat] },
											distanceField: "dist.calculated",
											maxDistance: 5 * 1000,
											distanceMultiplier: 1 / 1000,
											spherical: true
										}
									},
									//matching data 
									{
										$match: {
											$expr: {
												$and: [
													{$eq:["$$active","true"]},
													{ $eq: ["$$seller_id", "$_id"] },
                                                    
													{$ne: ["$$seller_id", mongoose.Types.ObjectId(tokenv._id)]}
												]
											}
										}
									},
									//matching delivery options
									{
										$match: {
											$expr: {
												$and: [
													{$in:[req.params.option,"$Delivery_options"]}
												]
											}
										}
									},
									//show distance calculated
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
							$unwind:"$seller"
						},
						//lookup on favorite collection to get that if user liked this item
						{
							$lookup:{
								from:"favorites",
								let:{id:"$_id"},
								pipeline:[
									{
										$match:{
											$expr:{
												$and:[
													{$eq:["$$id","$item_id"]}
												]
											}
										}
									},
									{
										$count:"like_status"
									}
                                    
								],
								as:"fav" 
							}
						},
						//lookup on favorite collection to get that if user liked this item
						{
							$lookup:{
								from:"favorites",
								let:{id:"$_id"},
								pipeline:[
									{
										$match:{
											$expr:{
												$and:[
													{$eq:["$$id","$item_id"]},
													{$eq:["$user_id",mongoose.Types.ObjectId(tokenv._id)]}
												]
											}
										}
									}
								],
								as:"user_fav"
							}
						},
						{
							$unwind:"$fav"
						},
						{
							$unwind:{
								path:"$user_fav",
								preserveNullAndEmptyArrays:true
							}
						},  
						//limit on  item to give only 5 records
						{
							$limit:5
						},
						{
							$project:{
								"i_image":1,
								"item_name":1,
								"category":1,
								"count":"$fav.like_status",
								"liked":"$user_fav.like_status",
								"distance":{$round:["$seller.dist.calculated",2]}
							}
						},
						{
							$sort:{"count":-1}
						}

					],function (err, result) {
						if (result) {
							return res.json({
								sucess: true,
								data: result
							});
						}
						if (err) {
							return res.status(400).json({
								sucess: true,
								data: result
							});
						}
						else
						{
							return res.json({
								sucess:true,
								message:"no data available",
								data:result
							});
						}
					});
				}
			}
			else
			{
				return res.status(400).json({
					error:true,
					err:err1,
					message:"Something went wrong"
				});
			}
		});
        
	});
});
//new item on the App
app.get("/new-items", middleware.isloggedin, function (req, res) {
	var token = req.headers.authorization.split(" ")[1];
	//verify token
	jwtVerify(token, "creation").then(tokenv => {
		//find user on user collection
		user.findOne({ _id: tokenv._id }, function (err, result) {
			if (result) {
				//aggregate on item
				item.aggregate([
					//sort in descending order
					{
						$sort: { "date": -1 }
					},
					//limit apply to get 10 records
					{
						$limit:10
					},
					//lookup on user to get user detail
					{
						$lookup: {
							from: "users",
							let: { seller_id: "$seller_id",active:"$i_active"},
							//pipeline to get required data
							pipeline: [
								{
									//use geonear to calculate distance 
									$geoNear: {
										near: { type: "point", coordinates: [result.long, result.lat] },
										distanceField: "dist.calculated",
										maxDistance: 5 * 1000,
										distanceMultiplier: 1 / 1000,
										spherical: true
									}
								},
								//matching required check
								{
									$match: {
										$expr: {
											$and: [
												{$eq:["$$active","true"]},
												{ $eq: ["$$seller_id", "$_id"] },
                                            
												{$ne: ["$$seller_id", mongoose.Types.ObjectId(tokenv._id)]}
											]
										}
									}
								},
								//check delivery available on seller delivery option
								{
									$match: {
										$expr: {
											$and: [
												{$in:["delivery","$Delivery_options"]}
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
					//lookup on favorite to get favorite data
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
							"distance":{$round:["$seller.dist.calculated",2]},
							"seller_id": 1,
							"liked":"$favorites.like_status"
						}
					}

				], function (err, result) {
					if (result && result.length) {
						return res.json({
							sucess: true,
							data: result,
							message:"fetched sucessfully!"
						});
					}
					if (err) {
						return res.status(400).json({
							error: true,
							message:"Error while fetching new-items"
						});
					}
					else
					{
						return res.json({
							sucess:true,
							message:"no data available",
							data:result
						});
					}
				});

			}
		});
	}).catch(err => {
		console.log(err);
	});
});
//pickup
app.post("/pickup",middleware.isloggedin,function(req,res){
	var token = req.headers.authorization.split(" ")[1];
	//check searching is auto 
	if(req.body.option==="auto")
	{
		jwtVerify(token, "creation").then(tokenv => {
			//find id on user collection
			user.findOne({ _id: tokenv._id}, function (err, result)
			{
				if(result){
					//aggregate on user for getting user detail
					user.aggregate([
						{
							//geonear applied for getting calculated distance
							$geoNear: {
								near: { type: "point", coordinates: [result.long, result.lat] },
								distanceField: "dist.calculated",
								maxDistance: 5 * 1000,
								distanceMultiplier: 1 / 1000,
								spherical: true
							}
						},
						//matching verified seller
						{
							$match:{
								$expr:{
									$and:[
										{$eq:["$verified_seller",true]},
										{$ne:["$_id",mongoose.Types.ObjectId(tokenv._id)]}
									]
								}
							}
						},
						//lookup on reviews to getting reviews detail
						{
							$lookup:{
								from:"reviews",
								localField:"_id",
								foreignField:"seller_id",
								as:"reviews"
							}
						},
						//project apply to getting particular data
						{
							$project: {
								"reviews":{$avg:"$reviews.star"},
								"seller_name":"$name",
								"seller_image":"$image",
								"lat":"$lat",
								"lng":"$long",
								"distance":{$round:["$dist.calculated",2]},
								"seller_id": "$_id",
							}
						} 
					],function(err1,result1){
						if(result1)
						{
							return res.json({
								sucess:true,
								data:result1,
								message:"Pickup Api fetched sucessfully!"
							});
						}
						else {
							return res.status(400).json({
								error:true,
								message:"Error while fetching data"
							});
						}
					});
				}
			});
		});
	}
	else if(req.body.option==="manuall" && req.body.lat && req.body.lng)
	{   
		jwtVerify(token, "creation").then(tokenv => {
			user.findOne({ _id: tokenv._id }, function (err, result) {
				if(result){
					user.aggregate([
						{
							$geoNear: {
								near: { type: "point", coordinates: [parseFloat(req.body.lng), parseFloat(req.body.lat)] },
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
										{$eq:["$verified_seller",true]},
										{$ne:["$_id",mongoose.Types.ObjectId(tokenv._id)]}
									]
								}
							}
						},
						{
							$lookup:{
								from:"reviews",
								localField:"_id",
								foreignField:"seller_id",
								as:"reviews"
							}
						},
						{
							$project: {
								"reviews":{$avg:"$reviews.star"},
								"seller_name":"$name",
								"seller_image":"$image",
								"lat":"$lat",
								"lng":"$long",
								"distance":{$round:["$dist.calculated",2]},
								"seller_id": "$_id",
							}
						} 
					],function(err1,result1){
						if(result1)
						{
							return res.json({
								sucess:true,
								data:result1,
								message:"Pickup Api fetched sucessfully!"
							});
						}
						else {
							return res.status(400).json({
								error:true,
								message:"Error while fetching data"
							});
						}
					});
				}
			});
		}).catch(err => {
			console.log(err);
		});
	}
	else
	{
		res.status(400).json({
			error:true,
			message:"Please provide correct fields"  
		});
	}
});
//openning item
app.get("/view_item1/:item_id", middleware.isloggedin, function (req, res) {
	var token = req.headers.authorization.split(" ")[1];
	//verify token
	jwtVerify(token, "creation").then(tokenv => {
		//find user on user collection
		user.findOne({ _id: tokenv._id }, function (err, result) {
			if(result){
				//aggregate on item to get particular data
				item.aggregate([
					{
						//apply match for particular item
						$match:{
							"_id":mongoose.Types.ObjectId(req.params.item_id)
						}
					},
					//lookup on favorites collection to get favorites data
					{
						$lookup:{
							from:"favorites",
							pipeline:[
								{
									$match:{
										$expr:{
											$and:[
												{$eq:["$item_id",mongoose.Types.ObjectId(req.params.item_id)]},
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
					//lookup on user collection to get particular user
					{
						$lookup:{
							from:"users",
							let:{sellerid:"$seller_id"},
							//pipeline to get required data
							pipeline:[
								{
									//get distance from geonear
									$geoNear:{
										near: { type: "point", coordinates: [result.long, result.lat] },
										distanceField: "dist.calculated",
										maxDistance: 500 * 1000,
										distanceMultiplier: 1 / 1000,
										spherical: true
									}
								},
								//matching seller_id
								{
									$match:{
										$expr:{
											$and:[
												{$eq:["$$sellerid","$_id"]}
											]
										}
									}
								},
								//lookup on reviews to get review on seller
								{
									$lookup:{
										from:"reviews",
										pipeline:[
											{
												$match:{
													$expr:{
														$and:[
															{$eq:["$$sellerid","$seller_id"]}
														]
													}
												}
											}
										],
										as:"reviews"
									}
								}
                                     
							],
							as:"seller"
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
							"reviews":{$avg:"$seller.reviews.star"},
							"reviews_length":"$seller.reviews",
							"seller_name":"$seller.name",
							"distance":{$round:["$seller.dist.calculated",2]},
							"description":1,
							"liked":"$favorites.like_status",
							"seller_id":"$seller._id"

						}
					}
        
				],function(error,data){
					if(data)
					{
						data[0].reviews_length = data[0].reviews_length.length;
						return res.json({
							sucess:true,
							result:data
						});
					}
					if(error)
					{
						return res.status(400).json({
							error:true,
							Message:error
						});
					}
				});
			}
		});
	}).catch(err=>{
		return res.status(400).json({
			error:true,
			message:"Something went wrong"
		});
	});
});
//show order list to seller 
app.get("/show_orders_list_to_seller",middleware.isloggedin,function(req,res){
	var token = req.headers.authorization.split(" ")[1];
	//verify token
	jwtVerify(token,"creation").then(tokenv=>{ 
		//find seller data
		seller.findOne({_id:tokenv._id},function(err,result){
			if(result && result.verified_seller)
			{
				//aggregate on order
				order.aggregate([
					//sort data in descending order
					{
						$sort:{"date":-1}
					},
					//match the required fields
					{
						$match:{
							$expr:{
								$and:[
									{$eq:["$seller_id",mongoose.Types.ObjectId(tokenv._id)]},
									{$ne:["$order_status","cancel"]}
								]
							}
                            
						}
					},
					//lookup on users for user data
					{
						$lookup:{
							from:"users",
							localField:"user_id",
							foreignField:"_id",
							as:"user_detail"   
						}
					},
					//unwind data
					{
						$unwind:"$user_detail"
					},
					{
						$project:{
							all_item:1,
							order_type:1,
							"user_image":"$user_detail.image",
							"user_name":"$user_detail.name",
							"user_delivery_address":"$user_detail.delivery_address",
							seller_status:1,
							"orderAmount":{$sum:"$all_item.price"}
						}
					}
				],function(err1,result1){
					if(result1)
					{
						console.log("Result1=>",result1);
						return res.json({
							sucess:true,
							data:result1,
							message:"Data fetched sucessfully"
						});
					}
					else
					{
						return res.status(400).json({
							error:true,
							message:"Error while fetching data"
						});
					}
				});
			}
			else if(err)
			{
				return res.status(400).json({
					error:true,
					err:err,
					message:"user not found"
				});
			}
			else
			{
				return res.status(400).json({
					error:true,
					message:"May be you are not a seller"
				});
			}
		});
	});
});
//status changing of order_list
app.post("/show_order_status",middleware.isloggedin,function(req,res){
	var token = req.headers.authorization.split(" ")[1];
	//verify token
	jwtVerify(token,"creation").then(tokenv=>{
		//find seller id
		seller.findOne({_id:tokenv._id},function(err,result){
			//check the verified seller
			if(result && result.verified_seller)
			{
				//find the id in order
				order.findOne({seller_id:tokenv._id,_id:req.body.order_id},function(err1,result1){
					if(result1)
					{
						//check for seller_status
						if(result1.seller_status==="request")
						{
							if(req.body.status ==="accept")
							{
								//update the order data
								order.updateOne({_id:req.body.order_id},{seller_status:"pending",order_status:"track"},function(err2,result2){
									if(result2 && result2.nModified)
									{
										return res.json({
											sucess:true,
											message:"Order accepted sucessfully.. be ready for submit the order"
										});
									}
									else
									{
										return res.status(400).json({
											error:true,
											err:err2,
											message:"Something went wrong"
										});
									}
								});
							}
							//check for reject
							else if(req.body.status ==="reject")
							{
								//update order data
								order.updateOne({_id:req.body.order_id},{seller_status:"reject",order_status:"cancel"},function(err2,result2){
									if(result2 && result2.nModified)
									{
										return res.json({
											sucess:true,
											message:"Order rejected by you sucessfully"
										});
									}
									else
									{
										return res.status(400).json({
											error:true,
											err:err2,
											message:"Something went wrong"
										});
									}
								});
							}
							else
							{
								return res.status(400).json({
									error:true,
									message:"Please choose correct status"
								});
							}
						}
						//check for pending status
						else if(result1.seller_status==="pending")
						{
							//check for submit
							if(req.body.status === "submit")
							{
								//update the order
								order.updateOne({_id:req.body.order_id},{seller_status:"completed",order_status:"completed"},function(err3,result3){
									if(result3 && result3.nModified)
									{
										return res.json({
											sucess:true,
											message:"order submitted sucessfully"
										});
									}
									else
									{
										return res.status(400).json({
											error:true,
											err:err3,
											message:"Something went wrong"
										});
									}
								});
							}
							else
							{
								return res.status(400).json({
									error:true,
									message:"Provide correct status"
								});
							}
                            
						}
						//if all checks are fails
						else
						{
							return res.status(400).json({
								error:true,
								message:"Something went wrong"
							});
						}
					}
					else
					{
						return res.status(400).json({
							error:true,
							err:err1,
							message:"Something went wrong"
						});
					}  
				});
			}
			else
			{
				return res.status(400).json({
					error:true,
					err:err,
					message:"Something went wrong"
				});
			}
		});
	});
});
//cancel order by customer while in pending state
app.post("/cancel_order_for_user",middleware.isloggedin,function(req,res){
	var token = req.headers.authorization.split(" ")[1];
	//verify token
	jwtVerify(token,"creation").then(tokenv=>{
		//check for order_id
		if(req.body.order_id)
		{
			//find order
			order.findOne({_id:req.body.order_id,user_id:tokenv._id},function(error,result){
				if(result)
				{
					//checking the status
					if(result.order_status === "pending" && result.seller_status === "request"){
						//update data to cancel
						order.updateOne({_id:req.body.order_id},{seller_status:"reject",order_status:"cancel"},function(u_err,u_result){
							if(u_result)
							{
								return res.json({
									sucess:true,
									message:"Your order is canceled successfully"
								});
							}
							else if(u_err)
							{
								return res.status(400).json({
									error:true,
									err_message:u_err,
									message:"Error while canceling the order"
								});
							}
							else
							{
								return res.status(400).json({
									error:true,
									message:"Something went wrong"
								});
							}
						});
					}
					else
					{
						return res.status(400).json({
							error:true,
							message:"your order status not in Pending"
						});
					}
				}
				else
				{
					return res.status(400).json({
						error:true,
						err_message:error,
						message:"Something went wrong"
					});
				}
		    });
		}
		else
		{
			res.status(400).json({
				error:true,
				message:"Please provide order_id"
			});
		}
	}).catch(err=>{
		return res.status(400).json({
			error:true,
			err_message:err,
			message:"Something went wrong"
		});
	});
});
//change-password
app.post("/change-password", middleware.isloggedin, function (req, res) {
	//check for password length
	if ((req.body.new_password).length < 6) {
		return res.status(400).json({
			error: true,
			message: "New Password length should be 6 or more"
		});
	}
	var token = req.headers.authorization.split(" ")[1];
	//checking if this fields are available
	if (req.body.old_password && req.body.new_password && req.body.confirm_password) {
		//verify token
		jwtVerify(token, "creation").then(tokenv => {
			//find id in user collection
			user.findOne({ _id: tokenv._id }, function (err, result) {
				if (result) {
					//compare password using bcrypt
					bcrypt.compare(req.body.old_password, result.password, function (b_err, b_result) {
						if (b_result) {
							//matching password
							if (req.body.new_password === req.body.confirm_password) {
								//convert password to encrypted password through bcrypt
								bcrypt.hash(req.body.new_password, saltRounds, function (bb_err, bb_result) {
									if (bb_result) {
										//update user password
										user.updateOne({ _id: tokenv._id }, { password: bb_result }, function (u_err, u_result) {
											if (u_result) {
												return res.json({
													sucess: true,
													message: "Your password is sucessfully changed!!"
												});
											}
											else if (u_err) {
												return res.status(400).json({
													error: true,
													message: "Error while updating password"
												});
											}
										});
									}
									if (bb_err) {
										return res.status(400).json({
											error: true,
											message: "Error while updating password"
										});
									}
								});

							}
							else {
								return res.status(400).json({
									error: true,
									message: "Your New password and confirm password are not matched!!"
								});
							}
						}
						else if (b_result === false) {
							return res.status(400).json({
								error: true,
								message: "Old password not matched!"
							});
						}
						else {
							return res.status(400).json({
								error: true,
								message: "Something went wrong"
							});
						}
					});
				}
				if (err) {
					return res.status(400).json({
						error: true,
						message: "Something went wrong"
					});
				}
			});
		});
	}
});
//search
app.get("/search/:search",middleware.isloggedin,function(req,res){
	var token = req.headers.authorization.split(" ")[1];
	//verify token
	jwtVerify(token,"creation").then(tokenv=>{
		//finding data on user
		user.findOne({_id:tokenv._id},function(err,result){
			if(result)
			//aggregate apply to item to get particular data
			{    item.aggregate([
				{
					//matching seller_id with token_id
					$match:{
						$expr:{
							$and:[
								{$ne:["$seller_id",mongoose.Types.ObjectId(tokenv._id)]}
							]
						}
					}
				},
				//matching data with the help regex 
				{
					$match:{
						$or:[
							{item_name:{$regex:req.params.search,$options:"i"}},
							{category:{$regex:req.params.search,$options:"i"}},
                                    
						]
					}
				},
				//lookup on user
				{
					$lookup: {
						from: "users",
						let: { seller_id: "$seller_id",active:"$i_active"},
						//apply pipeline to match
						pipeline: [
							{
								//get distance with geonear
								$geoNear: {
									near: { type: "point", coordinates: [result.long, result.lat] },
									distanceField: "dist.calculated",
									maxDistance: 5 * 1000,
									distanceMultiplier: 1 / 1000,
									spherical: true
								}
							},
							//matching required condition
							{
								$match: {
									$expr: {
										$and: [
											{$eq:["$$active","true"]},
											{ $eq: ["$$seller_id", "$_id"] },
                                                
											{$ne: ["$$seller_id", mongoose.Types.ObjectId(tokenv._id)]}
										]
									}
								}
							},
							//matching data with delivery option
							{
								$match: {
									$expr: {
										$and: [
											{$in:["delivery","$Delivery_options"]}
										]
									}
								}
							}

						],
						as: "seller"
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
						"category":1,
						"seller_name":"$seller.name",
						"distance":{$round:["$seller.dist.calculated",1]}
					}
				}
                    
			],function(err,result){
				if(result){
					return res.json({
						sucess:true,
						data:result,
						message:"Data fetched successfully"
					});
				}
				else
				{
					return res.status(400).json({
						error:true,
						err:err,
						message:"Error while fetching data"
					});
				}
			});
			}
			else
			{
				return res.status(400).json({
					error:true,
					message:"user not found"
				});
			}
		});
        
	});
});
//fetching seller information 
app.get("/fetch_seller/:seller_id",middleware.isloggedin,function(req,res){
	//finding data on user collection
	user.findOne({_id:mongoose.Types.ObjectId(req.params.seller_id)},function(err,result){
		if(result)
		{
			//add object for show to user
			var add = {};
			add.delivery_address = result.delivery_address;
			add.image = result.image;
			add.name = result.name;
			add.bio = result.bio;
			return res.json({
				sucess:true,
				data:add,
				message:"Sucessfully fetched seller data"
			});
		}
		else
		{
			res.status(400).json({
				error:true,
				err:err,
				message:"Error while fetching data"
			});
		}
	});
});
//server listen
var port = process.env.PORT || 8086;
app.listen(port, function (err,result) {
	console.log(`Port is activated at ${port}`);
});