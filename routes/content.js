const express = require("express");
const router = express.Router();
const ContentItem = require("../models/ContentItem");

// ── Helper: sanitize a voicings object from request body ────
function parseVoicings(raw) {
  if (!raw || typeof raw !== "object") return {};
  const allowed = ["fullSong", "soprano", "alto", "tenor", "bass", "baritone", "solo"];
  const result = {};
  allowed.forEach((part) => {
    if (typeof raw[part] === "string") {
      result[`voicings.${part}`] = raw[part].trim();
    }
  });
  return result;
}

// POST /api/content — Create a new song
router.post("/", async (req, res) => {
  try {
    const { title, body, category, tags, author, fileType, voicings, scoreUrl } = req.body;

    if (!title || !body) {
      return res.status(400).json({ success: false, message: "Title and body are required." });
    }

    const item = new ContentItem({
      title,
      body,
      category: category || "Uncategorized",
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(",").map((t) => t.trim()) : []),
      author: author || "Anonymous",
      fileType: fileType || "text",
      voicings: {
        fullSong: voicings?.fullSong?.trim() || "",
        soprano:  voicings?.soprano?.trim()  || "",
        alto:     voicings?.alto?.trim()     || "",
        tenor:    voicings?.tenor?.trim()    || "",
        bass:     voicings?.bass?.trim()     || "",
        baritone: voicings?.baritone?.trim() || "",
        solo:     voicings?.solo?.trim()     || "",
      },
      scoreUrl: scoreUrl?.trim() || "",
    });

    const saved = await item.save();
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/content — List / search songs
router.get("/", async (req, res) => {
  try {
    const { search, category, tags, page = 1, limit = 20 } = req.query;
    let query = {};

    if (search)   query.$text = { $search: search };
    if (category) query.category = { $regex: category, $options: "i" };
    if (tags) {
      const tagList = tags.split(",").map((t) => t.trim());
      query.tags = { $in: tagList };
    }

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await ContentItem.countDocuments(query);
    const items = await ContentItem.find(query)
      .sort({ title: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: items,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/content/:id — Get a single song
router.get("/:id", async (req, res) => {
  try {
    const item = await ContentItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Content not found." });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/content/:id — Update a song
router.put("/:id", async (req, res) => {
  try {
    const { title, body, category, tags, author, fileType, voicings, scoreUrl } = req.body;

    const update = {};
    if (title)    update.title    = title;
    if (body)     update.body     = body;
    if (category) update.category = category;
    if (author)   update.author   = author;
    if (fileType) update.fileType = fileType;
    if (scoreUrl !== undefined) update.scoreUrl = scoreUrl.trim();

    if (tags) {
      update.tags = Array.isArray(tags)
        ? tags
        : tags.split(",").map((t) => t.trim()).filter(Boolean);
    }

    // Merge voicing fields individually so unset parts aren't wiped
    if (voicings && typeof voicings === "object") {
      Object.assign(update, parseVoicings(voicings));
    }

    const updated = await ContentItem.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ success: false, message: "Content not found." });
    res.json({ success: true, message: "Song updated successfully.", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/content/:id — Delete a song
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await ContentItem.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Content not found." });
    res.json({ success: true, message: "Content deleted successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
