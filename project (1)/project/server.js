var express = require("express");
var app= express();

var formidable = require("express-formidable");
app.use(formidable());

var mongodb = require("mongodb");
var mongoClient = mongodb.MongoClient;
var ObjectId = mongodb.ObjectID;

var http = require("http").createServer(app);
var bcrypt = require("bcrypt");
var fileSystem = require("fs");

var jwt = require("jsonwebtoken");
var secretToken = "myAccessTokenSecret1234567890";

var multer = require("multer");
var uuid = require("uuid");

app.use("/public",express.static(__dirname+"/public"));
app.set("view engine","ejs");

var socketIO = require("socket.io")(http);
var socketID = "";

var mainURL = "http://localhost:3000";

// socketIO.on("connection", function (socket) {
// 	console.log("User connected", socket.id);
// 	socketID = socket.id;
// });
var upload = multer({dest:''});

http.listen(3000,function(){
    console.log("Server started at port 3000");

    mongoClient.connect("mongodb://localhost:27017",function(error,client){
        var database = client.db("social_media_network");
        console.log("Database connected");

        // app.post("/test",upload.single('postImage'),function(request,result){
            
            
        //     console.log("coeiwdoinew");
        //     console.log(request.files.postImage.path);
        // });

        app.get("/signup",function(request, result){
            result.render("signup");
        });

        app.post("/signup", function(request, result){
            var username = request.fields.username;
            var password = request.fields.password;
            var name = request.fields.name;
            var email = request.fields.email;
            var mobno = request.fields.mobno;
            var gender = request.fields.gender;

            database.collection("users").findOne({"username": username},function(error, user){
                if(user == null){
                    database.collection("users").insertOne({
                        "username": username,
                        "password":password,
                        "name": name,
                        "email": email,
                        "gender": gender,
                        "mobno": mobno
                    },function(error, data){ 
                        result.json({
                            "status": "success",
                            "message": "Sigup successful.",
                            "accessToken": "set"
                        });
                    });
                }
                else{
                    result.json({
                        "status":"error",
                        "message": "username already exist"
                    });
                }
            });
        });

        app.get("/login",function(request,result){
            result.render("login");
        });

        app.post("/login", function(request, result){
            var username = request.fields.username;
            var password = request.fields.password;

            database.collection("users").findOne({"username": username}, function(error, user){
                if(user == null){
                    result.json({
                        "status": "error",
                        "message": "User not found."
                    });
                }
                else{
                    if(password==user.password){
                        var accessToken = jwt.sign({username:username}, secretToken);
                        database.collection("users").findOneAndUpdate(
                            {"username":username}, {
                            $set:{
                                "accessToken": accessToken
                            }
                        },function(error, data){
                            result.json({
                                "status": "success",
                                "message": "Login successful.",
                                "accessToken": accessToken
                            });
                        });
                    }
                    else{
                        result.json({
                            "status": "error",
                            "message": "Incorrect password."
                        })
                    }
                }
            })

        });

        app.get("/updateProfile", function(request, result){
           result.render("update_profile.ejs"); 
        });

        app.post("/updateProfile", function (request, result) {
			var accessToken = request.fields.accessToken;
			var name = request.fields.name;
			var email = request.fields.email;
            var mobno = request.fields.mobno;
            var displayPic = "";

			database.collection("users").findOne({
				"accessToken": accessToken
			}, function (error, user) {
				if (user == null) {
					result.json({
						"status": "error",
						"message": "Logged out"
					});
				} else {
                    if(request.files.disPic.size>0){
                        displayPic = "public/images/users/"+user.username+new Date().getTime()+request.files.disPic.name;

                        fileSystem.readFile(request.files.disPic.path,(err, data)=>{
                            if(err) throw err;
                            fileSystem.writeFile(displayPic,data,(err)=>{
                                if(err) throw err;
                            });
                            fileSystem.unlink(request.files.disPic.path,(err)=>{
                                if(err) throw err;
                            });
                        });
                    }
					database.collection("users").updateOne({
						"accessToken": accessToken
					}, {
						$set: {
							"name": name,
							"email": email,
                            "mobno": mobno,
                            "displayPic": displayPic
						}
					}, function (error, data) {
						result.json({
							"status": "status",
							"message": "Profile updated."
						});
					});
				}
			});
		});

        app.post("/getUserInfo", function(request, result){
            var aToken = request.fields.accessToken;
            database.collection("users").findOne({
                "accessToken": aToken
            }, function(error, user){
                if(user == null){
                    result.json({
                        "status": "error",
                        "message": "Logged out"
                    });
                }
                else{
                    result.json({
                        "status": "success",
                        "message": "Data fetched",
                        "userData": user
                    });
                }
            });
        });

        app.get("/logout", function(request, result){
            result.redirect("/login");
        });

        app.get("/profile", function(request, result){
            result.render("profile");
        });

        app.get("/", function(request, result){
            result.render("newsfeed");
        });
        app.post("/", function(request, result){
            result.render("newsfeed");
        });

        app.post("/createPost", function(request, result){
            var postText = request.fields.postText;
            var aToken = request.fields.accessToken;
            var postImage = "";
            var postVideo = "";
            console.log(request.files.postImage.type);
            var date = new Date();
            var timeStamp = date.getTime();
            database.collection("users").findOne({
                "accessToken": aToken
            },function(error, user){
                if(request.files.postImage.size>0){
                    postImage = "public/images/posts/"+user.username+new Date().getTime()+request.files.postImage.name;

                    fileSystem.readFile(request.files.postImage.path, function(err, data){
                        if(err) throw err;
                        console.log('postImage read');
                        fileSystem.writeFile(postImage, data, function(err){
                            if(err) throw err;
                            console.log('postImage saved');
                        });
    
                        fileSystem.unlink(request.files.postImage.path, function(err){
                            if(err) throw err;
                        })
                    });
                }

                if(request.files.postVideo.size>0){
                    postVideo = "public/videos/posts/"+user.username+new Date().getTime()+request.files.postVideo.name;
                    fileSystem.readFile(request.files.postVideo.path, function(err, data){
                        if(err) throw err;
                        console.log('postVideo read');
                        fileSystem.writeFile(postVideo, data, function(err){
                            if(err) throw err;
                            console.log('postVideo saved');
                        });
    
                        fileSystem.unlink(request.files.postVideo.path, function(err){
                            if(err) throw err;
                        })
                    });   
                }
                database.collection("posts").insertOne({
                    "posttext": postText,
                    "timestamp": timeStamp,
                    "postImage": postImage,
                    "postVideo": postVideo,
                    "user":{
                        "_id": user._id,
                        "name": user.username
                    }
                },function(error, post){
                    // result.json({
                    //     "status":"success",
                    //     "message":"working"
                    // });
                    database.collection("users").updateOne({
                        "accessToken": aToken
                    },{
                        $push:{
                            "posts":{
                                "_id": post.insertedId
                            }
                        }
                    },function(error, data){
                        result.json({
                            "status":"success",
                            "message":"working"
                        })
                        //result.redirect("/n");
                    });
                    
                });
            });
        });

        app.post("/getPosts", function(request, result){
            database.collection("posts").find({}).sort({"timestamp":-1}).toArray(function(error, data){
                
                //console.log(data);
                result.json({
                    "status":"success",
                    "data":data
                });
            });
        });

        app.post("/getMyPosts", function(request, result){
            var aToken = request.fields.aToken;
            database.collection("users").findOne({
                "accessToken": aToken
            },function(error, user){
                if(user!=null){
                    database.collection("posts").find({
                        "user._id":user._id
                    }).sort({"timestamp":-1}).toArray(function(error, data){
                        result.json({
                            "status": "success",
                            "data": data
                        });
                    });
                }
            });
        });

        app.post("/likePost", function(request, result){
            var pId = request.fields.postId;
            var uId = request.fields.userId;
            var liked = request.fields.liked;
            //console.log(pId.length);
            // database.collection("posts").find({}).toArray(function(err,data){
            //     console.log(data);
            // })       
            // database.collection("posts").findOne({"_id": ObjectId(pId)},function(err, data){
            //     console.log(data);
            // });
            
            if(liked == "false"){
                console.log(pId, uId, liked);
                database.collection("posts").findOneAndUpdate({
                    "_id": ObjectId(pId)
                }, {
                    $push:{
                        "likes":{
                            "_id":ObjectId(uId)
                        }
                    }
                },{
                    returnOriginal: false
                },function(error, data){
                    console.log(data.value.likes);
                    // console.log(data.value.likes.length);
                    result.json({
                        "likes": data.value.likes
                    });
                });
            }
            else{
                //console.log(pId, uId, liked);
                database.collection("posts").findOneAndUpdate({
                    "_id": ObjectId(pId)
                }, {
                    $pull:{
                        "likes":{
                            "_id":ObjectId(uId)
                        }
                    }
                },{
                    returnOriginal: false
                },function(error, data){
                    console.log(data.value.likes);
                    result.json({
                        "likes": data.value.likes
                    });
                });
            }
        });

        app.post("/getLikedUsers",function(request, result){
            var pId = request.fields.postId;
            var likedUsers = [];
            var count = 0;
            // database.collection("posts").findOne({"_id": ObjectId(pId)},{likes:1},function(err,data){
            //     console.log(data);
            // })

            database.collection("posts").findOne({"_id":ObjectId(pId)}, function(err, post){
                post.likes.forEach(element => {
                    database.collection("users").findOne({"_id":element._id}, function(err, user){
                        likedUsers.push(user.username);
                        
                        if(++count == post.likes.length){
                            result.json({
                                "likedUsers": likedUsers
                            })
                        }
                    })
                });

                // console.log(likedUsers);
                // result.json({
                //     "likedUsers": likedUsers
                // })

            })
        });

        app.get("/search/:sVal", function(request, result){
            var sVal = request.params.sVal;
            result.render("searchRes",{
                "sVal": sVal
            }); 
            
        });

        app.post("/search", function(request, result){
            var sVal = request.fields.srchVal;
            console.log(sVal);
            database.collection("users").find({
                "username": {$regex:".*"+sVal+".*",$options: "i"}
            }).toArray(function(err, data){
                //console.log(data);
                result.json({
                    "data": data
                }); 
            });
            
        });

        app.post("/addComment", function(request, result){
            var pId = request.fields.postId;
            var uId = request.fields.userId;
            var comment = request.fields.comment;
            var flag = request.fields.flag;
            var coll;
            console.log(flag);
            if(flag == '0'){
                coll = "posts";
            }
            else{
                coll = "comments";
            }
            // console.log(pId);
            // console.log(comment);
            database.collection("users").findOne({"_id": ObjectId(uId)}, function(err, user){
                if(user!=null){
                    database.collection("comments").insertOne({
                        "postId": ObjectId(pId),
                        "user": {
                            "_id": ObjectId(uId),
                            "username": user.username
                        },
                        "comment": comment
                        
                    }, function(err, data){
                        //console.log(data);
                        database.collection(coll).findOneAndUpdate({"_id": ObjectId(pId)},{
                            $push:{
                                "comments": {
                                    "_id": data.insertedId
                                }
                            }
                        },{ 
                            returnOriginal: false
                        });
                        
                        result.json({
                            "status": "success"
                        })
                    });
                }
            });
            
        });

        app.post("/getComments", function(request, result){
            var pId = request.fields.postId;
            var flag = request.fields.flag;
            var coll;
            console.log(flag);
            if(flag == '0'){
                coll = "posts";
            }
            else{
                coll = "comments";
            }
            database.collection(coll).findOne({"_id": ObjectId(pId)}, function(err, post){
                //console.log(post.comments.length);
                var comnts = [];
                var count = 0;
                if(post!=null&&typeof post.comments!="undefined"){
                    post.comments.forEach(element => {
                        database.collection("comments").findOne({_id: element._id}, function(err, data){
                            comnts.push(data);
    
                            if(++count == post.comments.length){
                                console.log(comnts);
                                result.json({
                                    "comments": comnts
                                })
                            }
                        })
                    });
                }
                else{
                    result.json({
                        "comments": comnts
                    })
                }
            })
        })

    });
});