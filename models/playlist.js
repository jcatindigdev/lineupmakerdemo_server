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
    // Ordered list of songs/chord charts in this lineup.
    items: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ContentItem",
      },
    ],
    // Opaque id used in the shareable link (?playlist=<shareId>).
    // Access to it is still gated by the `auth` middleware on the
    // GET /:shareId route — knowing this id alone isn't enough,
    // the requester must also be logged in.
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
