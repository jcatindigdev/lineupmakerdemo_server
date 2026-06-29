const express = require("express");
const router = express.Router();
const PDFDocument = require("pdfkit");
const ContentItem = require("../models/ContentItem");
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ExternalHyperlink } = require("docx");

// ── Voice / Instrument parts ────────────────────────────────
const SINGER_PARTS = ["fullSong", "soprano", "alto", "tenor", "bass", "baritone", "solo"];
const INSTRUMENT_PARTS = [
  "electricGuitar1", "electricGuitar2", "electricGuitar3",
  "acousticGuitar1", "acousticGuitar2",
  "violin", "viola", "keys", "bass2", "drums", "keys2", "others",
];
const ALL_VOICE_PARTS = [...SINGER_PARTS, ...INSTRUMENT_PARTS];

const VOICE_LABELS = {
  // Singers
  fullSong: "Full Song", soprano: "Soprano", alto: "Alto",
  tenor: "Tenor", bass: "Bass", baritone: "Baritone", solo: "Solo",
  // Instruments
  electricGuitar1: "Electric Guitar 1", electricGuitar2: "Electric Guitar 2",
  electricGuitar3: "Electric Guitar 3", acousticGuitar1: "Acoustic Guitar 1",
  acousticGuitar2: "Acoustic Guitar 2", violin: "Violin", viola: "Viola", keys: "Keys",
  bass2: "Bass", drums: "Drums", keys2: "Keys 2", others: "Others",
};

// ── PDF Generation ──────────────────────────────────────────
router.post("/generate", async (req, res) => {
  try {
    const { items, title, author, includeMetadata } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Please provide an ordered list of item IDs." });
    }

    const ids = items.map((i) => i.id);
    const fetchedMap = {};
    const fetchedItems = await ContentItem.find({ _id: { $in: ids } });
    fetchedItems.forEach((item) => { fetchedMap[item._id.toString()] = item; });

    const orderedItems = items
      .sort((a, b) => a.order - b.order)
      .map((i) => fetchedMap[i.id])
      .filter(Boolean);

    if (orderedItems.length === 0) {
      return res.status(404).json({ success: false, message: "None of the provided item IDs were found." });
    }

    const MARGIN      = 60;
    const PAGE_H      = 841.89;
    const PAGE_W      = 595.28;
    const CONTENT_BOT = PAGE_H - MARGIN;
    const FOOTER_Y    = CONTENT_BOT - 20;
    const BODY_START  = 120;

    const doc = new PDFDocument({
      margin: MARGIN,
      size: "A4",
      autoFirstPage: true,
      info: {
        Title: title || "Generated Document",
        Author: author || "PDF Builder App",
        Creator: "PDF Builder App",
      },
    });

    const safeTitle = (title || "document").replace(/[^a-z0-9_\-]/gi, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.pdf"`);
    doc.pipe(res);

    // ── Cover Page ──────────────────────────────────────────
    doc.rect(0, 0, PAGE_W, PAGE_H).fill("#1a1a2e");
    doc.fill("#e8d5b7").fontSize(34).font("Helvetica-Bold")
      .text(title || "Generated Document", MARGIN, 210, { align: "center", width: PAGE_W - MARGIN * 2 });
    if (author) {
      doc.fontSize(14).font("Helvetica").fill("#a09080")
        .text(`by ${author}`, MARGIN, 280, { align: "center", width: PAGE_W - MARGIN * 2 });
    }
    doc.fontSize(11).fill("#706050")
      .text(`Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
        MARGIN, 315, { align: "center", width: PAGE_W - MARGIN * 2 });

    const songCount  = orderedItems.filter(i => i.contentType !== "chord").length;
    const chordCount = orderedItems.filter(i => i.contentType === "chord").length;
    let countText = "";
    if (songCount > 0 && chordCount > 0) {
      countText = `${songCount} song${songCount !== 1 ? "s" : ""}  ·  ${chordCount} chords${chordCount !== 1 ? "s" : ""}`;
    } else if (chordCount > 0) {
      countText = `${chordCount} chords${chordCount !== 1 ? "s" : ""}`;
    } else {
      countText = `${songCount} song${songCount !== 1 ? "s" : ""}`;
    }
    doc.fontSize(10).fill("#504030")
      .text(countText, MARGIN, 338, { align: "center", width: PAGE_W - MARGIN * 2 });

    doc.addPage();
    doc.fill("#1a1a2e").fontSize(22).font("Helvetica-Bold").text("Table of Contents", MARGIN, MARGIN);
    doc.moveTo(MARGIN, 94).lineTo(PAGE_W - MARGIN, 94).strokeColor("#c9a96e").lineWidth(1).stroke();

    let tocY = 112;
    orderedItems.forEach((item, idx) => {
      if (tocY < CONTENT_BOT - 20) {
        const isChord = item.contentType === "chord";
        const tocLabel = isChord ? `[Chords] ${item.title}` : item.title;
        doc.fill("#222222").fontSize(12).font("Helvetica")
          .text(`${idx + 1}.  ${tocLabel}`, MARGIN, tocY, { width: PAGE_W - MARGIN * 2 - 90 });
        doc.fill("#999999").fontSize(10)
          .text(item.category || "", PAGE_W - MARGIN - 90, tocY, { width: 90, align: "right" });
        tocY += 28;
      }
    });

    orderedItems.forEach((item, idx) => {
      const isChord = item.contentType === "chord";
      doc.addPage();

      // Gold bar
      doc.rect(0, 0, PAGE_W, 7).fill("#c9a96e");

      // Badge
      doc.circle(79, 68, 19).fill("#1a1a2e");
      doc.fill("#e8d5b7").fontSize(13).font("Helvetica-Bold")
        .text(`${idx + 1}`, 64, 62, { width: 30, align: "center" });

      // Title
      doc.fill("#1a1a2e").fontSize(18).font("Helvetica-Bold")
        .text(item.title, 112, 54, { width: PAGE_W - 112 - MARGIN, lineBreak: false });

      if (isChord) {
        doc.fill("#c9a96e").fontSize(9).font("Helvetica")
          .text("[Chords]", 112, 76, { width: PAGE_W - 112 - MARGIN, lineBreak: false });
      }

      // Metadata
      if (includeMetadata) {
        const meta = [];
        if (item.author && item.author !== "Anonymous") meta.push(`Author: ${item.author}`);
        if (item.category) meta.push(`Category: ${item.category}`);
        if (item.tags && item.tags.length) meta.push(`Tags: ${item.tags.join(", ")}`);
        if (meta.length) {
          const metaY = isChord ? 87 : 76;
          doc.fill("#999999").fontSize(9).font("Helvetica")
            .text(meta.join("  ·  "), 112, metaY, { width: PAGE_W - 112 - MARGIN, lineBreak: false });
        }
      }

      // Divider
      doc.moveTo(MARGIN, 100).lineTo(PAGE_W - MARGIN, 100).strokeColor("#ddd0c0").lineWidth(0.5).stroke();

      // Body — Courier for chords, Helvetica for songs
      const bodyFont = isChord ? "Courier" : "Helvetica";
      const bodySize = isChord ? 10 : 11;
      const bodyLineGap = isChord ? 1 : 3;
      const bodyParaGap = isChord ? 2 : 6;

      doc.fill("#2c2c2c").fontSize(bodySize).font(bodyFont)
        .text(item.body, MARGIN, BODY_START, {
          width: PAGE_W - MARGIN * 2,
          lineGap: bodyLineGap,
          paragraphGap: bodyParaGap,
        });

      // ── Resources section ───────────────────────────────
      const voicings       = item.voicings || {};
      const activeSingers  = SINGER_PARTS.filter(p => voicings[p]);
      const activeInstr    = INSTRUMENT_PARTS.filter(p => voicings[p]);
      const hasScore       = !!item.scoreUrl;

      if (activeSingers.length || activeInstr.length || hasScore) {
        doc.moveDown(1);
        doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y)
          .strokeColor("#e8d5b7").lineWidth(1).stroke();
        doc.moveDown(0.5);

        doc.fillColor("#c9a96e").fontSize(8).font("Helvetica-Bold")
          .text("RESOURCES", MARGIN, doc.y);
        doc.moveDown(0.4);

        // Singers sub-group
        if (activeSingers.length) {
          doc.fillColor("#aaaaaa").fontSize(7).font("Helvetica-Bold")
            .text("SINGERS", MARGIN + 8, doc.y);
          doc.moveDown(0.3);
          activeSingers.forEach((part) => {
            doc.fillColor("#666666").fontSize(9).font("Helvetica")
              .text(`${VOICE_LABELS[part]}:  `, MARGIN + 16, doc.y, { continued: true });
            doc.fillColor("#1a5ca8").fontSize(9)
              .text("Open audio", { link: voicings[part], underline: true });
          });
          doc.moveDown(0.3);
        }

        // Instruments sub-group
        if (activeInstr.length) {
          doc.fillColor("#aaaaaa").fontSize(7).font("Helvetica-Bold")
            .text("INSTRUMENTS", MARGIN + 8, doc.y);
          doc.moveDown(0.3);
          activeInstr.forEach((part) => {
            doc.fillColor("#666666").fontSize(9).font("Helvetica")
              .text(`${VOICE_LABELS[part]}:  `, MARGIN + 16, doc.y, { continued: true });
            doc.fillColor("#1a5ca8").fontSize(9)
              .text("Open audio", { link: voicings[part], underline: true });
          });
          doc.moveDown(0.3);
        }

        // Score
        if (hasScore) {
          doc.fillColor("#666666").fontSize(9).font("Helvetica")
            .text("Music Score:  ", MARGIN + 8, doc.y, { continued: true });
          doc.fillColor("#1a5ca8").fontSize(9)
            .text("View music score", { link: item.scoreUrl, underline: true });
        }
      }

      // Footer
      doc.moveTo(MARGIN, FOOTER_Y - 4)
        .lineTo(PAGE_W - MARGIN, FOOTER_Y - 4)
        .strokeColor("#eeeeee").lineWidth(0.5).stroke();
      doc.fillColor("#cccccc").fontSize(8).font("Helvetica")
        .text(`${title || "Document"}  —  Section ${idx + 1} of ${orderedItems.length}`,
          MARGIN, FOOTER_Y, { width: PAGE_W - MARGIN * 2, align: "center", lineBreak: false });
    });

    doc.end();
  } catch (err) {
    console.error("PDF generation error:", err);
    if (!res.headersSent) res.status(500).json({ success: false, message: err.message });
  }
});

// ── JSON Preview ────────────────────────────────────────────
router.post("/preview", async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Please provide an ordered list of item IDs." });
    }
    const ids = items.map((i) => i.id);
    const fetchedMap = {};
    const fetched = await ContentItem.find({ _id: { $in: ids } }, "title category author tags contentType createdAt");
    fetched.forEach((item) => { fetchedMap[item._id.toString()] = item; });
    const preview = items
      .sort((a, b) => a.order - b.order)
      .map((i) => fetchedMap[i.id])
      .filter(Boolean)
      .map((item, idx) => ({
        order: idx + 1, id: item._id, title: item.title,
        category: item.category, author: item.author,
        tags: item.tags, contentType: item.contentType,
      }));
    res.json({ success: true, preview });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DOCX Generation ─────────────────────────────────────────
router.post("/generate-docx", async (req, res) => {
  try {
    const { items, title, author, includeMetadata } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Please provide an ordered list of item IDs." });
    }
    const ids = items.map((i) => i.id);
    const fetchedMap = {};
    const fetchedItems = await ContentItem.find({ _id: { $in: ids } });
    fetchedItems.forEach((item) => { fetchedMap[item._id.toString()] = item; });
    const orderedItems = items
      .sort((a, b) => a.order - b.order)
      .map((i) => fetchedMap[i.id])
      .filter(Boolean);
    if (orderedItems.length === 0) {
      return res.status(404).json({ success: false, message: "None of the provided item IDs were found." });
    }

    const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const children = [];

    children.push(
      new Paragraph({ text: title || "Generated Document", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: author ? `by ${author}` : "", italics: true, color: "888888", size: 28 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: date, color: "aaaaaa", size: 22 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: `${orderedItems.length} section${orderedItems.length !== 1 ? "s" : ""}`, color: "aaaaaa", size: 20 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ text: "" }),
    );

    children.push(new Paragraph({ text: "Table of Contents", heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
    orderedItems.forEach((item, idx) => {
      const tocLabel = item.contentType === "chord" ? `[Chords] ${item.title}` : item.title;
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${idx + 1}.  `, bold: true, color: "c9a96e" }),
          new TextRun({ text: tocLabel }),
          new TextRun({ text: `  —  ${item.category || ""}`, color: "aaaaaa", size: 18 }),
        ],
      }));
    });

    // Sections
    orderedItems.forEach((item) => {
      const isChord  = item.contentType === "chord";
      const bodyFont = isChord ? "Courier New" : undefined;
      const bodySize = isChord ? 20 : 22;

      children.push(new Paragraph({ text: item.title, heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));

      if (isChord) {
        children.push(new Paragraph({
          children: [new TextRun({ text: "[Chords]", color: "c9a96e", size: 18, italics: true })],
        }));
      }

      if (includeMetadata) {
        const meta = [];
        if (item.author && item.author !== "Anonymous") meta.push(`Author: ${item.author}`);
        if (item.category) meta.push(`Category: ${item.category}`);
        if (item.tags && item.tags.length) meta.push(`Tags: ${item.tags.join(", ")}`);
        if (meta.length) {
          children.push(new Paragraph({
            children: [new TextRun({ text: meta.join("  ·  "), italics: true, color: "999999", size: 18 })],
          }));
        }
      }

      children.push(new Paragraph({ text: "" }));

      // Body — Courier New for chords
      (item.body || "").split("\n").forEach((line) => {
        const run = { text: line === "" ? " " : line, size: bodySize };
        if (bodyFont) run.font = bodyFont;
        children.push(new Paragraph({ children: [new TextRun(run)], spacing: { after: 0 } }));
      });

      // Resources
      const voicings      = item.voicings || {};
      const activeSingers = SINGER_PARTS.filter(p => voicings[p]);
      const activeInstr   = INSTRUMENT_PARTS.filter(p => voicings[p]);
      const hasScore      = !!item.scoreUrl;

      if (activeSingers.length || activeInstr.length || hasScore) {
        children.push(new Paragraph({ text: "" }));
        children.push(new Paragraph({
          children: [new TextRun({ text: "Resources", bold: true, color: "c9a96e", size: 20 })],
        }));

        if (activeSingers.length) {
          children.push(new Paragraph({
            children: [new TextRun({ text: "Singers", bold: true, color: "888888", size: 18 })],
          }));
          activeSingers.forEach((part) => {
            children.push(new Paragraph({
              children: [
                new TextRun({ text: `${VOICE_LABELS[part]}:  `, size: 18 }),
                new ExternalHyperlink({ link: voicings[part], children: [new TextRun({ text: "Open audio", style: "Hyperlink", size: 18 })] }),
              ],
            }));
          });
        }

        if (activeInstr.length) {
          children.push(new Paragraph({
            children: [new TextRun({ text: "Instruments", bold: true, color: "888888", size: 18 })],
          }));
          activeInstr.forEach((part) => {
            children.push(new Paragraph({
              children: [
                new TextRun({ text: `${VOICE_LABELS[part]}:  `, size: 18 }),
                new ExternalHyperlink({ link: voicings[part], children: [new TextRun({ text: "Open audio", style: "Hyperlink", size: 18 })] }),
              ],
            }));
          });
        }

        if (hasScore) {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: "Music Score:  ", size: 18 }),
              new ExternalHyperlink({ link: item.scoreUrl, children: [new TextRun({ text: "View music score", style: "Hyperlink", size: 18 })] }),
            ],
          }));
        }
      }
    });

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);
    const safeTitle = (title || "document").replace(/[^a-z0-9_\-]/gi, "_");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.docx"`);
    res.send(buffer);

  } catch (err) {
    console.error("DOCX generation error:", err);
    if (!res.headersSent) res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
