import express from "express";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";

const app = express();
app.use(express.raw({ type: "audio/mpeg", limit: "50mb" }));

// ruta principal
app.get("/", (_, res) => {
  res.send("🎵 Preview Service online. Send POST with MP3 binary to /generate");
});

// endpoint principal
app.post("/generate", async (req, res) => {
  try {
    const inputPath = "/tmp/input.mp3";
    const outputPath = "/tmp/preview.mp3";

    // guarda el binario recibido
    fs.writeFileSync(inputPath, req.body);

    // procesa con FFmpeg (corta primeros 10s)
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg(inputPath)
      .setStartTime(0)
      .duration(10)
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .audioFrequency(44100)
      .on("end", () => {
        const buffer = fs.readFileSync(outputPath);
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Content-Disposition", 'inline; filename="preview.mp3"');
        res.send(buffer);
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      })
      .on("error", (err) => {
        console.error(err);
        res.status(500).send("❌ Error processing file: " + err.message);
      })
      .save(outputPath);
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Error: " + err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Preview service running on port ${PORT}`));
