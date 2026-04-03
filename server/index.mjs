import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));

const distDir = path.resolve(__dirname, "../dist");

app.post("/api/generate", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  // Output cap for story length; override with GEMINI_MAX_OUTPUT_TOKENS.
  const maxOutputTokens = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 2048;

  if (!apiKey) {
    res.status(500).json({ error: "Missing GEMINI_API_KEY on the server." });
    return;
  }

  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt : "";
  if (!prompt.trim()) {
    res.status(400).json({ error: "Missing `prompt` in request body." });
    return;
  }

  try {
    const genAI = new GoogleGenAI({ apiKey });
    const response = await genAI.models.generateContent({
      model,
      contents: prompt,
      config: {
        maxOutputTokens,
        temperature: 0.75,
        topK: 40,
        // 0 disables thinking/reasoning budget (SDK: ThinkingConfig.thinkingBudget).
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const text = response?.text ?? "";
    if (!text.trim()) {
      res.status(502).json({ error: "Gemini returned empty text." });
      return;
    }

    res.json({ text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

app.use(express.static(distDir));

app.get("*", (req, res) => {
  res.sendFile(path.join(distDir, "index.html"), (err) => {
    if (err) res.status(404).send("Not found");
  });
});

const port = Number(process.env.PORT || "8080");
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
