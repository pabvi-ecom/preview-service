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
    // Crea un nombre temporal único
    const id = randomUUID();
    const inputPath = `/tmp/input-${id}.mp3`;
    const outputPath = `/tmp/preview-${id}.mp3`;

    // Guarda el binario recibido
    fs.writeFileSync(inputPath, req.body);

    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg(inputPath)
      .setStartTime(0)
      .duration(20) // segundos de preview
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .audioFrequency(44100)
      .on("end", () => {
        const buffer = fs.readFileSync(outputPath);

        // Limpieza de archivos temporales
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);

        // Enviamos solo el binario recortado con metadatos
        res.setHeader("Content-Type", "application/json");
        res.send({
          filename: `${id}_preview.mp3`,
          mimeType: "audio/mpeg",
          data: buffer.toString("base64"),
        });
      })
      .on("error", (err) => {
        console.error(err);
        res.status(500).json({ error: "❌ Error processing file", message: err.message });
      })
      .save(outputPath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "❌ General error", message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Preview service running on port ${PORT}`));
