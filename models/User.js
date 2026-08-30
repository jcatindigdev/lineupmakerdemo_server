const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
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

UserSchema.pre("validate", function (next) {
  if (!this.username && !this.email) {
    this.invalidate("username", "Either a username or an email is required.");
  }
  next();
});

module.exports = mongoose.model("User", UserSchema);
