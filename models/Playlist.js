const mongoose = require("mongoose");
const crypto = require("crypto");

const playlistSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Playlist title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ContentItem",
      },
    ],
    shareId: {
      type: String,
      unique: true,
      index: true,
      default: () => crypto.randomBytes(8).toString("hex"),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Playlist", playlistSchema);
