const mongoose = require("mongoose");

const contentItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    body: {
      type: String,
      required: [true, "Body content is required"],
      trim: true,
    },
    category: {
      type: String,
      trim: true,
      default: "Uncategorized",
    },
    tags: {
      type: [String],
      default: [],
    },
    author: {
      type: String,
      trim: true,
      default: "Anonymous",
    },
    fileType: {
      type: String,
      enum: ["text", "markdown", "html"],
      default: "text",
    },

    contentType: {
      type: String,
      enum: ["song", "chord"],
      default: "song",
    },

    voicings: {
      fullSong: { type: String, trim: true, default: "" },
      soprano:  { type: String, trim: true, default: "" },
      alto:     { type: String, trim: true, default: "" },
      tenor:    { type: String, trim: true, default: "" },
      baritone: { type: String, trim: true, default: "" },
      solo:     { type: String, trim: true, default: "" },
      electricGuitar1: { type: String, trim: true, default: "" },
      electricGuitar2: { type: String, trim: true, default: "" },
      electricGuitar3: { type: String, trim: true, default: "" },
      bass:            { type: String, trim: true, default: "" },
      acousticGuitar1: { type: String, trim: true, default: "" },
      acousticGuitar2: { type: String, trim: true, default: "" },
      violin:          { type: String, trim: true, default: "" },
      viola:           { type: String, trim: true, default: "" },
      keys:            { type: String, trim: true, default: "" },
      bass2:           { type: String, trim: true, default: "" },
      drums:           { type: String, trim: true, default: "" },
      keys2:           { type: String, trim: true, default: "" },
      others:          { type: String, trim: true, default: "" },
    },

    scoreUrl: {
      type: String,
      trim: true,
      default: "",
    },

    attachmentUrl: {
      type: String,
      trim: true,
      default: "",
    },
    attachmentName: {
      type: String,
      trim: true,
      default: "",
    },
    attachmentType: {
      type: String,
      enum: ["image", "pdf", ""],
      default: "",
    },
  },
  { timestamps: true }
);

contentItemSchema.index({ title: "text", body: "text", tags: "text", category: "text" });

module.exports = mongoose.model("ContentItem", contentItemSchema);
