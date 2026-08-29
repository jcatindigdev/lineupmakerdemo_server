const express = require("express");
const router = express.Router();
const Playlist = require("../models/Playlist");
const auth = require("../middleware/auth");

// Every route below requires `auth` — this is what keeps shared
// links private: having the link isn't enough, the requester also
// has to be signed in with a valid token before the server will
// hand back the playlist's songs/chords.

// POST /api/playlists — create a playlist from an ordered list of content item ids
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

// GET /api/playlists/mine — playlists created by the logged-in user
// NOTE: this must stay registered before GET /:shareId, or Express
// will try to match "mine" as a shareId instead.
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

// GET /api/playlists/:shareId — fetch a playlist for playback.
// Any logged-in user can open it via the link, not just the owner.
router.get("/:shareId", auth, async (req, res) => {
  try {
    const playlist = await Playlist.findOne({ shareId: req.params.shareId }).populate("items");
    if (!playlist) return res.status(404).json({ success: false, message: "Playlist not found." });
    res.json({ success: true, data: playlist });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/playlists/:shareId/save — makes the current user their own
// independent copy of a shared playlist (same title + song/chord list),
// so it shows up in their own "My Playlists" going forward. This is a
// snapshot, not a live link — later edits to the original won't carry
// over to the copy.
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

// PUT /api/playlists/:id — rename or reorder (owner only)
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

// DELETE /api/playlists/:id — owner only
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
