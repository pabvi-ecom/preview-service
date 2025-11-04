import express from "express";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";
import { randomUUID } from "crypto";

const app = express();

// ✅ Middleware para que Express lea bien los query params
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 🟢 Solo después de eso definimos el RAW parser (para audio)
app.use("/generate", express.raw({ type: "audio/mpeg", limit: "50mb" }));

app.get("/", (_, res) => {
  res.send("🎵 Preview Service online. Send POST with MP3 binary to /generate");
});

app.post("/generate", async (req, res) => {
  try {
    // ----------------------------------------------------------
    // 1️⃣ OBTENER NOMBRE ORIGINAL DEL QUERY
    // ----------------------------------------------------------
    const originalFileName =
      req.query.filename ||
      req.headers["x-filename"] ||
      `${randomUUID()}.mp3`;

    const normalizedName = originalFileName.toLowerCase().endsWith(".mp3")
      ? originalFileName
      : `${originalFileName}.mp3`;

    const baseName = normalizedName.replace(/\.mp3$/i, "");
    const previewName = `${baseName}p.mp3`;

    console.log(`🎧 Generando preview para: ${normalizedName} → ${previewName}`);

    // ----------------------------------------------------------
    // 2️⃣ GUARDAR EL ARCHIVO TEMPORAL
    // ----------------------------------------------------------
    const id = randomUUID();
    const inputPath = `/tmp/input-${id}.mp3`;
    const outputPath = `/tmp/output-${id}.mp3`;

    if (!Buffer.isBuffer(req.body)) {
      console.error("❌ Error: req.body no es un Buffer");
      return res
        .status(400)
        .json({ error: "Invalid body", message: "Expected binary MP3 buffer" });
    }

    fs.writeFileSync(inputPath, req.body);

    // ----------------------------------------------------------
    // 3️⃣ GENERAR EL PREVIEW (primeros 20 segundos)
    // ----------------------------------------------------------
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg(inputPath)
      .setStartTime(0)
      .duration(25)
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .audioFrequency(44100)
      .on("end", () => {
        const buffer = fs.readFileSync(outputPath);
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);

        res.setHeader("Content-Type", "application/json");
        res.send({
          filename: previewName,
          mimeType: "audio/mpeg",
          data: buffer.toString("base64"),
        });

        console.log(`✅ Preview generado: ${previewName}`);
      })
      .on("error", (err) => {
        console.error("❌ Error en FFmpeg:", err.message);
        res.status(500).json({ error: "FFmpeg error", message: err.message });
      })
      .save(outputPath);
  } catch (err) {
    console.error("❌ General error:", err);
    res
      .status(500)
      .json({ error: "General error", message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Preview service running on port ${PORT}`)
);
