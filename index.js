import express from "express";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";
import { randomUUID } from "crypto";

const app = express();

// ✅ Aceptar audio en binario puro (desde n8n)
app.use(express.raw({ type: "audio/mpeg", limit: "50mb" }));

app.get("/", (_, res) => {
  res.send("🎵 Preview Service online. Send POST with MP3 binary to /generate");
});

app.post("/generate", async (req, res) => {
  try {
    // ----------------------------------------------------------
    // 1️⃣ OBTENER NOMBRE ORIGINAL
    // ----------------------------------------------------------
    // n8n envía el header: x-filename: {{$binary.audio.fileName}}
    const originalFileName = req.headers["x-filename"] || `${randomUUID()}.mp3`;

    // Asegurar que termina en .mp3 (por seguridad)
    const normalizedName = originalFileName.toLowerCase().endsWith(".mp3")
      ? originalFileName
      : `${originalFileName}.mp3`;

    // Crear nombre para el preview -> añade "p" antes de .mp3
    const baseName = normalizedName.replace(/\.mp3$/i, "");
    const previewName = `${baseName}p.mp3`;

    console.log(`🎧 Generando preview para: ${normalizedName} → ${previewName}`);

    // ----------------------------------------------------------
    // 2️⃣ GUARDAR EL ARCHIVO TEMPORAL
    // ----------------------------------------------------------
    const id = randomUUID();
    const inputPath = `/tmp/input-${id}.mp3`;
    const outputPath = `/tmp/output-${id}.mp3`;

    // req.body debe ser un Buffer (binario real)
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
      .duration(20)
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .audioFrequency(44100)
      .on("end", () => {
        try {
          const buffer = fs.readFileSync(outputPath);

          // Limpieza de temporales
          fs.unlinkSync(inputPath);
          fs.unlinkSync(outputPath);

          // ----------------------------------------------------------
          // 4️⃣ DEVOLVER RESPUESTA JSON
          // ----------------------------------------------------------
          res.setHeader("Content-Type", "application/json");
          res.send({
            filename: previewName,
            mimeType: "audio/mpeg",
            data: buffer.toString("base64"),
          });

          console.log(`✅ Preview generado: ${previewName}`);
        } catch (readErr) {
          console.error("❌ Error al leer el archivo generado:", readErr);
          res
            .status(500)
            .json({ error: "Read error", message: readErr.message });
        }
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

// ----------------------------------------------------------
// 5️⃣ INICIAR SERVICIO
// ----------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Preview service running on port ${PORT}`)
);
