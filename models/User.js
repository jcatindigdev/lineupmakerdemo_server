const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is Required'],
      unique: true,
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is Required'],
      unique: true,
      lowercase: true, // Forces all records to be consistent
      trim: true
    },
    password: {
      type: String,
      required: [true, 'Password is Required']
    },
    isAdmin: {
      type: Boolean,
      default: false
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", UserSchema);