const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI)
var Schema = mongoose.Schema;

var exerciseSchema = new Schema({
  description: String,
  duration: Number,
  date: Date
});

var userSchema = new Schema({
  username: String,
  exercises: [exerciseSchema]
});

var user = mongoose.model('User', userSchema);
var exercise = mongoose.model('Exercise', exerciseSchema);

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


app.post("/api/exercise/new-user", function(req, res){
  if(req.body.username != null && req.body.username != ""){
    user.create({"username": req.body.username}, function(err, data){
      if(err) res.json({"error": "internal error"});
      else res.json({"username": req.body.username, "userId": data._id});
    });
  }else
    res.json({"error": "invalid username"});
});

app.get("/api/exercise/users", function(req, res){
  user.find({}).select("-__v").exec( function(err, data){
    // Limitar para que no muestre los exercises de cada usuario, solo los datos que se dan al registrarse
    if(err) res.json({"error": "internal error"});
    else res.json(data);
  });
});

app.post("/api/exercise/add", function(req, res){
  if(req.body.userId != null && req.body.userId != "" && req.body.description != null && req.body.description != "" 
     && req.body.duration != null && req.body.duration != ""){
    // If no date set we use current date
    if (req.body.date == null) req.body.date = new Date();
        
    var newEx = new exercise({"description": req.body.description, "duration": Number(req.body.duration), "date": new Date(Date.parse(req.body.date))});
    // We find the document, push the new exercise data, remove the field __v from the output and show it
    user.findByIdAndUpdate(req.body.userId, {$push: {"exercises": newEx}}, {"fields": {"_id": 1, "username": 1, "exercises": 1}, "new": true}, function(err, data){
      if(err) res.json({"error": "internal error"});
      else res.json(data);
    });
  }else{
    res.json({"error": "blank fields"});
  }
});

app.get("/api/exercise/log", function(req, res){
  if(req.query.userId == null){
    res.json({"error": "userId required"});
  }else{
    var requestUserData; 
    user.findById(req.query.userId, function(err, data){
      if(err) res.json({"error": "internal error"});
      else {
        var from = (req.query.from != null) ? new Date(Date.parse(req.query.from)) : new Date(0);
        var to = (req.query.to != null) ? new Date(Date.parse(req.query.to)) : new Date();

        user.aggregate([{$match: {'_id': mongoose.Types.ObjectId(req.query.userId)}}, {$unwind: '$exercises'}, {$match: { 'exercises.date': {$gte: from, $lte: to}}}, {$project: {'_id': 0, 'exercises._id': 0}}, {$replaceRoot: { newRoot: "$exercises" }}], function(err, exercises){
          if(err) res.json({"error": "internal error"});
          else {
            res.json({'_id': data['_id'], 'username': data['username'], 'count': exercises.length, 'log': exercises});
          }
        });
        
      }
    });
    
    
  }
  
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})


const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
