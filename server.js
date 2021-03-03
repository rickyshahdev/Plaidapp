const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const passport = require("passport");
const cors = require("cors")
const db = mongoose.connection
const users = require("./routes/api/users");
const plaid = require("./routes/api/plaid");
require('dotenv').config()
const app = express();

// Bodyparser middleware

if (process.env.NODE_ENV === "production"){
  app.use(express.static("client/build"));

  app.get("*", (req,res) => {
    res.sendFile(path.resolve(__dirname, "../client", "build", "index.html"));
  })
}
app.use(
  bodyParser.urlencoded({
    extended: false
  })
);
app.use(bodyParser.json());
app.use(cors())

// DB Config
const mongodbURI = require("./config/keys").mongoURI;

// Connect to MongoDB
mongoose
  .connect(
    mongodbURI,
    { useNewUrlParser: true ,
      useUnifiedTopology: true,
      useFindAndModify: false,
      useCreateIndex: true
    }
  )
  .then(() => console.log("MongoDB successfully connected"))
  .catch(err => console.log(err));
  db.on('error', err => console.log(err.message + ' is mongod not running?'))
  db.on('disconnected', () => console.log('mongo disconnected'))
// Passport middleware
app.use(passport.initialize());

// Passport config
require("./config/passport")(passport);

// Routes
app.use("/api/users", users);
app.use("/api/plaid", plaid);

const port = 5000;

app.listen(port, () => console.log(`Server up and running on port ${port} !`));
