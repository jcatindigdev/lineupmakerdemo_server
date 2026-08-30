const express = require("express");
const router = express.Router();
const ContentItem = require("../models/ContentItem");
const upload = require("../middleware/upload");

const ALL_VOICING_PARTS = [
  "fullSong", "soprano", "alto", "tenor", "baritone", "solo",
  "electricGuitar1", "electricGuitar2", "electricGuitar3",
  "bass", "acousticGuitar1", "acousticGuitar2",
  "violin", "viola", "keys", "bass2", "drums", "keys2", "others",
];

function parseVoicings(raw) {
  if (!raw || typeof raw !== "object") return {};
  const result = {};
  ALL_VOICING_PARTS.forEach((part) => {
    if (typeof raw[part] === "string") {
      result[`voicings.${part}`] = raw[part].trim();
    }
  });
  return result;
}

function buildVoicings(v) {
  const out = {};
  ALL_VOICING_PARTS.forEach((part) => {
    out[part] = v?.[part]?.trim() || "";
  });
  return out;
}

router.post("/upload", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file was uploaded." });
    }

    const attachmentType = req.file.mimetype === "application/pdf" ? "pdf" : "image";
    const base64 = req.file.buffer.toString("base64");
    const attachmentUrl = `data:${req.file.mimetype};base64,${base64}`;

    res.status(201).json({
      success: true,
      attachmentUrl,
      attachmentName: req.file.originalname,
      attachmentType,
    });
  });
});

router.post("/", async (req, res) => {
  try {
    const {
      title, body, category, tags, author, fileType, contentType, voicings, scoreUrl,
      attachmentUrl, attachmentName, attachmentType,
    } = req.body;

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
      contentType: contentType === "chord" ? "chord" : "song",
      voicings: buildVoicings(voicings),
      scoreUrl: scoreUrl?.trim() || "",
      attachmentUrl: attachmentUrl?.trim() || "",
      attachmentName: attachmentName?.trim() || "",
      attachmentType: attachmentType === "pdf" || attachmentType === "image" ? attachmentType : "",
    });

    const saved = await item.save();
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const { search, category, tags, contentType, page = 1, limit = 20 } = req.query;
    const conditions = [];

    if (contentType === "chord") {
      conditions.push({ contentType: "chord" });
    } else if (contentType === "song") {
      conditions.push({ $or: [{ contentType: "song" }, { contentType: { $exists: false } }] });
    }

    if (search) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      conditions.push({ title: { $regex: safe, $options: "i" } });
    }

    if (category) conditions.push({ category: { $regex: category, $options: "i" } });

    if (tags) {
      const tagList = tags.split(",").map((t) => t.trim());
      conditions.push({ tags: { $in: tagList } });
    }

    const query = conditions.length > 0 ? { $and: conditions } : {};
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

router.get("/:id", async (req, res) => {
  try {
    const item = await ContentItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Content not found." });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const {
      title, body, category, tags, author, fileType, contentType, voicings, scoreUrl,
      attachmentUrl, attachmentName, attachmentType,
    } = req.body;

    const update = {};
    if (title)       update.title       = title;
    if (body)        update.body        = body;
    if (category)    update.category    = category;
    if (author)      update.author      = author;
    if (fileType)    update.fileType    = fileType;
    if (contentType) update.contentType = contentType;
    if (scoreUrl !== undefined) update.scoreUrl = scoreUrl.trim();
    if (attachmentUrl !== undefined) update.attachmentUrl = attachmentUrl.trim();
    if (attachmentName !== undefined) update.attachmentName = attachmentName.trim();
    if (attachmentType !== undefined) {
      update.attachmentType = (attachmentType === "pdf" || attachmentType === "image") ? attachmentType : "";
    }

    if (tags) {
      update.tags = Array.isArray(tags)
        ? tags
        : tags.split(",").map((t) => t.trim()).filter(Boolean);
    }

    if (voicings && typeof voicings === "object") {
      Object.assign(update, parseVoicings(voicings));
    }

    const updated = await ContentItem.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ success: false, message: "Content not found." });
    res.json({ success: true, message: "Updated successfully.", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

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
