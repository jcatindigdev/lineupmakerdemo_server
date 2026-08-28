const multer = require("multer");

// ── No local disk storage ───────────────────────────────────────
// Files are buffered in memory only, long enough to base64-encode
// them and hand them off to be embedded directly in the MongoDB
// document (see routes/content.js POST /upload). Nothing is ever
// written to disk, so there's no folder to clean up and nothing
// gets lost on redeploy/restart.
//
// NOTE: a single MongoDB document is capped at 16MB, and base64
// inflates a file's size by ~37%. The file-size limit below (8MB)
// is set so an encoded file plus the rest of a chord's fields
// stays safely under that cap. If you need to support larger
// files, move to GridFS instead of embedding the file in the doc.

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB raw (~11MB once base64-encoded)

function fileFilter(req, file, cb) {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG, WEBP, GIF images or PDF files are allowed."));
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

module.exports = upload;
