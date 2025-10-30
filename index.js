import express from "express";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";
import { randomUUID } from "crypto";

const app = express();
app.use(express.raw({ type: "audio/mpeg", limit: "50mb" }));

app.get("/", (_, res) => {
  res.send("🎵 Preview Service online. Send POST with MP3 binary to /generate");
});

app.post("/generate", async (req, res) => {
  try {
    // 🔹 Intentamos obtener el nombre original del archivo
    const headerFileName = req.headers["x-filename"];
    const queryFileName = req.query.filename;
    const fallbackFileName = `${randomUUID()}.mp3`;

    // 🔹 Si viene algo como "1028.mp3", lo usamos, si no, generamos uno
    const originalFileName = headerFileName || queryFileName || fallbackFileName;

    // 🔹 Aseguramos que tiene extensión .mp3 (por si acaso)
    const baseName = originalFileName.replace(/\.[^/.]+$/, "");
    const extension = originalFileName.toLowerCase().endsWith(".mp3") ? "mp3" : "mp3";

    // 🔹 Generamos el nombre del preview: 1028p.mp3
    const previewName = `${baseName}p.${extension}`;

    console.log(`🎧 Generando preview para: ${originalFileName} → ${previewName}`);

    // Crea archivos temporales únicos
    const id = randomUUID();
    const inputPath = `/tmp/input-${id}.mp3`;
    const outputPath = `/tmp/output-${id}.mp3`;

    fs.writeFileSync(inputPath, req.body);

    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg(inputPath)
      .setStartTime(0)
      .duration(20)
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
      })
      .on("error", (err) => {
        console.error("❌ Error en FFmpeg:", err.message);
        res.status(500).json({ error: "FFmpeg error", message: err.message });
      })
      .save(outputPath);
  } catch (err) {
    console.error("❌ General error:", err);
    res.status(500).json({ error: "General error", message: err.message });
  }
});

