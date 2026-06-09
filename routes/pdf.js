const express = require("express");
const router = express.Router();
const PDFDocument = require("pdfkit");
const ContentItem = require("../models/ContentItem");
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require("docx");

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

    // ── Page geometry constants ─────────────────────────────────
    const MARGIN      = 60;
    const PAGE_H      = 841.89;
    const PAGE_W      = 595.28;
    const CONTENT_BOT = PAGE_H - MARGIN;    // 781.89 — bottom of safe zone
    const FOOTER_Y    = CONTENT_BOT - 20;   // 761.89 — well inside safe zone
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

    // ── Cover Page ──────────────────────────────────────────────
    doc.rect(0, 0, PAGE_W, PAGE_H).fill("#1a1a2e");

    doc.fill("#e8d5b7").fontSize(34).font("Helvetica-Bold")
      .text(title || "Generated Document", MARGIN, 210, {
        align: "center", width: PAGE_W - MARGIN * 2,
      });

    if (author) {
      doc.fontSize(14).font("Helvetica").fill("#a09080")
        .text(`by ${author}`, MARGIN, 280, {
          align: "center", width: PAGE_W - MARGIN * 2,
        });
    }

    doc.fontSize(11).fill("#706050")
      .text(
        `Generated on ${new Date().toLocaleDateString("en-US", {
          year: "numeric", month: "long", day: "numeric",
        })}`,
        MARGIN, 315, { align: "center", width: PAGE_W - MARGIN * 2 }
      );

    doc.fontSize(10).fill("#504030")
      .text(
        `${orderedItems.length} section${orderedItems.length !== 1 ? "s" : ""}`,
        MARGIN, 338, { align: "center", width: PAGE_W - MARGIN * 2 }
      );

    // ── Table of Contents ───────────────────────────────────────
    doc.addPage();
    doc.fill("#1a1a2e").fontSize(22).font("Helvetica-Bold")
      .text("Table of Contents", MARGIN, MARGIN);

    doc.moveTo(MARGIN, 94)
      .lineTo(PAGE_W - MARGIN, 94)
      .strokeColor("#c9a96e").lineWidth(1).stroke();

    let tocY = 112;
    orderedItems.forEach((item, idx) => {
      if (tocY < CONTENT_BOT - 20) {
        doc.fill("#222222").fontSize(12).font("Helvetica")
          .text(`${idx + 1}.  ${item.title}`, MARGIN, tocY, {
            width: PAGE_W - MARGIN * 2 - 90,
          });
        doc.fill("#999999").fontSize(10)
          .text(item.category || "", PAGE_W - MARGIN - 90, tocY, {
            width: 90, align: "right",
          });
        tocY += 28;
      }
    });

    // ── Content Sections ────────────────────────────────────────
    orderedItems.forEach((item, idx) => {
      // Each song always gets its own fresh page
      doc.addPage();

      // Gold bar at the very top of the page
      doc.rect(0, 0, PAGE_W, 7).fill("#c9a96e");

      // Section number badge
      doc.circle(79, 68, 19).fill("#1a1a2e");
      doc.fill("#e8d5b7").fontSize(13).font("Helvetica-Bold")
        .text(`${idx + 1}`, 64, 62, { width: 30, align: "center" });

      // Song title
      doc.fill("#1a1a2e").fontSize(18).font("Helvetica-Bold")
        .text(item.title, 112, 54, {
          width: PAGE_W - 112 - MARGIN,
          lineBreak: false,
        });

      // Metadata line
      if (includeMetadata) {
        const meta = [];
        if (item.author && item.author !== "Anonymous") meta.push(`Author: ${item.author}`);
        if (item.category) meta.push(`Category: ${item.category}`);
        if (item.tags && item.tags.length) meta.push(`Tags: ${item.tags.join(", ")}`);
        if (meta.length) {
          doc.fill("#999999").fontSize(9).font("Helvetica")
            .text(meta.join("  ·  "), 112, 76, {
              width: PAGE_W - 112 - MARGIN,
              lineBreak: false,
            });
        }
      }

      // Divider line under header
      doc.moveTo(MARGIN, 100)
        .lineTo(PAGE_W - MARGIN, 100)
        .strokeColor("#ddd0c0").lineWidth(0.5).stroke();

      // Body text — no height cap, full content renders across as many pages as needed
      doc.fill("#2c2c2c").fontSize(11).font("Helvetica")
        .text(item.body, MARGIN, BODY_START, {
          width: PAGE_W - MARGIN * 2,
          lineGap: 3,
          paragraphGap: 6,
        });

      // Footer — drawn on the last page of this song's content
      // FOOTER_Y is well inside the safe zone so it never triggers auto-pagination
      doc.moveTo(MARGIN, FOOTER_Y - 4)
        .lineTo(PAGE_W - MARGIN, FOOTER_Y - 4)
        .strokeColor("#eeeeee").lineWidth(0.5).stroke();

      doc.fill("#cccccc").fontSize(8).font("Helvetica")
        .text(
          `${title || "Document"}  —  Song ${idx + 1} of ${orderedItems.length}`,
          MARGIN, FOOTER_Y,
          { width: PAGE_W - MARGIN * 2, align: "center", lineBreak: false }
        );
    });

    doc.end();
  } catch (err) {
    console.error("PDF generation error:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
});

// JSON preview endpoint (used by Postman)
router.post("/preview", async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Please provide an ordered list of item IDs." });
    }

    const ids = items.map((i) => i.id);
    const fetchedMap = {};
    const fetched = await ContentItem.find(
      { _id: { $in: ids } },
      "title category author tags createdAt"
    );
    fetched.forEach((item) => { fetchedMap[item._id.toString()] = item; });

    const preview = items
      .sort((a, b) => a.order - b.order)
      .map((i) => fetchedMap[i.id])
      .filter(Boolean)
      .map((item, idx) => ({
        order: idx + 1,
        id: item._id,
        title: item.title,
        category: item.category,
        author: item.author,
        tags: item.tags,
      }));

    res.json({ success: true, preview });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DOCX Generation ────────────────────────────────────────────────────────
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

    // ── Cover ──────────────────────────────────────────────────
    children.push(
      new Paragraph({ text: title || "Generated Document", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: author ? `by ${author}` : "", italics: true, color: "888888", size: 28 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: date, color: "aaaaaa", size: 22 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: `${orderedItems.length} song${orderedItems.length !== 1 ? "s" : ""}`, color: "aaaaaa", size: 20 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ text: "" }),
    );

    // ── Table of Contents ──────────────────────────────────────
    children.push(
      new Paragraph({ text: "Table of Contents", heading: HeadingLevel.HEADING_1, pageBreakBefore: true }),
    );
    orderedItems.forEach((item, idx) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${idx + 1}.  `, bold: true, color: "c9a96e" }),
            new TextRun({ text: item.title }),
            new TextRun({ text: `  —  ${item.category || ""}`, color: "aaaaaa", size: 18 }),
          ],
        })
      );
    });

    // ── Song Sections ──────────────────────────────────────────
    orderedItems.forEach((item) => {
      // Song title as new page
      children.push(
        new Paragraph({ text: item.title, heading: HeadingLevel.HEADING_1, pageBreakBefore: true })
      );

      // Metadata
      if (includeMetadata) {
        const meta = [];
        if (item.author && item.author !== "Anonymous") meta.push(`Author: ${item.author}`);
        if (item.category) meta.push(`Category: ${item.category}`);
        if (item.tags && item.tags.length) meta.push(`Tags: ${item.tags.join(", ")}`);
        if (meta.length) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: meta.join("  ·  "), italics: true, color: "999999", size: 18 })],
            })
          );
        }
      }

      // Divider space
      children.push(new Paragraph({ text: "" }));

      // Body — split on newlines to preserve line breaks
      const lines = (item.body || "").split("\n");
      lines.forEach((line) => {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line === "" ? " " : line, size: 22 })],
            spacing: { after: 0 },
          })
        );
      });
    });

    // Build and send document
    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);
    const safeTitle = (title || "document").replace(/[^a-z0-9_\-]/gi, "_");

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.docx"`);
    res.send(buffer);

  } catch (err) {
    console.error("DOCX generation error:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
});

module.exports = router;
