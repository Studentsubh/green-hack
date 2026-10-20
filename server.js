import "dotenv/config";
import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

// Tiny JSON-file store (no native deps)
const DB = path.join(__dirname, "data", "history.json");
fs.mkdirSync(path.dirname(DB), { recursive: true });
const load = () => (fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB, "utf8")) : []);
const save = (d) => fs.writeFileSync(DB, JSON.stringify(d, null, 2));

const SYSTEM = `You are RepairX, an e-waste repair assistant. Given a device, symptoms and an optional photo, respond ONLY with JSON:
{"verdict":"repair|professional|recycle","likely_cause":string,"confidence":"low|medium|high","difficulty":"easy|moderate|hard","time":string,"tools":[string],"parts":[string],"steps":[string],"safety":[string],"disposal":string}
Max 8 steps. Flag battery, mains-voltage and capacitor risks. Recommend professional repair or certified e-waste recycling when DIY is unsafe or not worthwhile.`;

function parseJson(text) {
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  return JSON.parse(text.slice(s, e + 1));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/diagnose", upload.single("image"), async (req, res) => {
  try {
    const { device = "Other", symptoms = "" } = req.body;
    if (!symptoms.trim()) return res.status(400).json({ error: "Describe the problem first." });
    const input = [{ type: "text", text: `Device: ${device}\nProblem: ${symptoms}` }];
    if (req.file && /^image\/(jpeg|png|webp|gif)$/.test(req.file.mimetype)) {
      input.push({ type: "image", mime_type: req.file.mimetype, data: req.file.buffer.toString("base64") });
    }
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is missing. Add it to .env and restart the server." });
    }
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify({
        model: MODEL,
        input,
        system_instruction: SYSTEM,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: {
            type: "object",
            properties: {
              verdict: { type: "string", enum: ["repair", "professional", "recycle"] },
              likely_cause: { type: "string" },
              confidence: { type: "string", enum: ["low", "medium", "high"] },
              difficulty: { type: "string", enum: ["easy", "moderate", "hard"] },
              time: { type: "string" },
              tools: { type: "array", items: { type: "string" } },
              parts: { type: "array", items: { type: "string" } },
              steps: { type: "array", items: { type: "string" } },
              safety: { type: "array", items: { type: "string" } },
              disposal: { type: "string" },
            },
            required: ["verdict", "likely_cause", "confidence", "difficulty", "time", "tools", "parts", "steps", "safety", "disposal"],
          },
        },
        store: false,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      console.error("Gemini API error:", payload.error?.message || response.statusText);
      return res.status(502).json({ error: "Gemini could not complete the diagnosis. Check the key, model, and API access." });
    }
    const answer = payload.output_text || payload.steps
      ?.filter((step) => step.type === "model_output")
      .flatMap((step) => step.content || [])
      .filter((part) => part.type === "text")
      .map((part) => part.text || "")
      .join("");
    if (!answer) throw new Error("Gemini returned no text");
    const result = parseJson(answer);
    const entry = { id: randomUUID(), createdAt: new Date().toISOString(), device, symptoms, result };
    save([entry, ...load()].slice(0, 100));
    res.json(entry);
  } catch (err) {
    console.error("Diagnosis failed:", err.message);
    res.status(500).json({ error: "Diagnosis failed. Check the server logs for details." });
  }
});

app.get("/api/history", (_req, res) => res.json(load()));
app.delete("/api/history/:id", (req, res) => {
  save(load().filter((h) => h.id !== req.params.id));
  res.status(204).end();
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`RepairX running at http://localhost:${port}`));
