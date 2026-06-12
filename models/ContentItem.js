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

    // ── Voicing audio links ──────────────────────────────────
    voicings: {
      fullSong: { type: String, trim: true, default: "" },
      soprano:  { type: String, trim: true, default: "" },
      alto:     { type: String, trim: true, default: "" },
      tenor:    { type: String, trim: true, default: "" },
      bass:     { type: String, trim: true, default: "" },
      baritone: { type: String, trim: true, default: "" },
      solo:     { type: String, trim: true, default: "" },
    },

    // ── Music score link ─────────────────────────────────────
    scoreUrl: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

contentItemSchema.index({
  title: "text",
  body: "text",
  tags: "text",
  category: "text",
});

module.exports = mongoose.model("ContentItem", contentItemSchema);
