const express = require("express");
const router = express.Router();
const Playlist = require("../models/Playlist");
const auth = require("../middleware/auth");

router.post("/", auth, async (req, res) => {
  try {
    const { title, items } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Playlist title is required." });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Add at least one song or chord chart first." });
    }

    const playlist = await Playlist.create({
      title: title.trim(),
      owner: req.user.id,
      items,
    });

    res.status(201).json({ success: true, data: playlist });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/mine", auth, async (req, res) => {
  try {
    const playlists = await Playlist.find({ owner: req.user.id })
      .sort({ createdAt: -1 })
      .populate("items");
    res.json({ success: true, data: playlists });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/:shareId", auth, async (req, res) => {
  try {
    const playlist = await Playlist.findOne({ shareId: req.params.shareId }).populate("items");
    if (!playlist) return res.status(404).json({ success: false, message: "Playlist not found." });
    res.json({ success: true, data: playlist });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/:shareId/save", auth, async (req, res) => {
  try {
    const source = await Playlist.findOne({ shareId: req.params.shareId });
    if (!source) {
      return res.status(404).json({ success: false, message: "Playlist not found." });
    }
    if (String(source.owner) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: "This is already your own playlist." });
    }

    const saved = await Playlist.create({
      title: source.title,
      owner: req.user.id,
      items: source.items,
    });
    const populated = await saved.populate("items");

    res.status(201).json({ success: true, message: "Saved to your playlists!", data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ success: false, message: "Playlist not found." });
    if (String(playlist.owner) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: "You can only edit your own playlists." });
    }

    const { title, items } = req.body;
    if (title !== undefined && title.trim()) playlist.title = title.trim();
    if (Array.isArray(items) && items.length > 0) playlist.items = items;

    const updated = await playlist.save();
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ success: false, message: "Playlist not found." });
    if (String(playlist.owner) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: "You can only delete your own playlists." });
    }
    await playlist.deleteOne();
    res.json({ success: true, message: "Playlist deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
