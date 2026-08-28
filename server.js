require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const contentRoutes = require("./routes/content");
const pdfRoutes = require("./routes/pdf");
const authRoutes = require("./routes/auth");
const playlistRoutes = require("./routes/playlists");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/pdf_builder";


app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://lineupmakerdemo-client.vercel.app"
  ]
}));
// Attachments (chord photos/PDFs) are embedded as base64 in the
// MongoDB document rather than stored on disk, so the JSON body
// limit needs enough headroom for an encoded file (see middleware/upload.js).
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

app.use("/api/content", contentRoutes);
app.use("/api/pdf", pdfRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/playlists", playlistRoutes);

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "PDF Builder API is running",
    timestamp: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error." });
});

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected:", MONGODB_URI);
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      console.log(`📄 API docs: http://localhost:${PORT}/api/health`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });
