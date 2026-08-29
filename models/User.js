const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      unique: true,
      sparse: true, // allows many users to have no username without unique-index clashes
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true, // allows many users to have no email without unique-index clashes
      lowercase: true, // Forces all records to be consistent
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

// A user needs at least one way to log in — enforced here as a
// safety net in addition to the check in routes/auth.js.
UserSchema.pre("validate", function (next) {
  if (!this.username && !this.email) {
    this.invalidate("username", "Either a username or an email is required.");
  }
  next();
});

module.exports = mongoose.model("User", UserSchema);
