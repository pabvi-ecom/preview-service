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
    // Puede venir en un header o en query params o en el body JSON (dependiendo de cómo lo envíes desde n8n)
    const originalFileName =
      req.headers["x-filename"] ||
      req.query.filename ||
      req.body?.filename ||
      `${randomUUID()}.mp3`;

    // Extrae nombre base y extensión
    const baseName = originalFileName.replace(/\.[^/.]+$/, "");
    const extension = originalFileName.split(".").pop();

    // Genera el nuevo nombre con "p" al final
    const previewName = `${baseName}p.${extension}`;

    // Crea archivos temporales únicos
    const id = randomUUID();
    const inputPath = `/tmp/input-${id}.mp3`;
    const outputPath = `/tmp/output-${id}.mp3`;

    // Guarda el binario recibido en inputPath
    fs.writeFileSync(inputPath, req.body);

    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg(inputPath)
      .setStartTime(0)
      .duration(20) // segundos del preview
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .audioFrequency(44100)
      .on("end", () => {
        const buffer = fs.readFileSync(outputPath);

        // Limpieza de archivos temporales
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);

        // Devuelve JSON con nombre coherente + base64 del preview
        res.setHeader("Content-Type", "application/json");
        res.send({
          filename: previewName,
          mimeType: "audio/mpeg",
          data: buffer.toString("base64"),
        });
      })
      .on("error", (err) => {
        console.error(err);
        res.status(500).json({
          error: "❌ Error processing file",
          message: err.message,
        });
      })
      .save(outputPath);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "❌ General error", message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Preview service running on port ${PORT}`)
);
