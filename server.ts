import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini API Initialization
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  const fallbacks = [
    "Bu gün təqvimin ən gözəl günüdür, çünki sənin günündür. Ürəyin saflıqla, ömrün nurla dolsun. Hər yeni günün qəlbinin arzuları ilə başlasın. Həmişə sevgi ilə əhatə olunasan. AD GÜNÜN MÜBARƏK BALACA çocuk",
    "Həyat bir nağıldırsa, sənin nağılın ən xoşbəxt sonluqlarla bitsin. Ulduzlar qədər parlaq, dənizlər qədər dərin bir ömür arzulayıram. Sən hər şeyin ən gözəlinə layiqsən. AD GÜNÜN MÜBARƏK BALACA çocuk",
    "Günəşin istisi, baharın rayihəsi və sevginin ən təmiz forması hər zaman səninlə olsun. Sənin varlığın ətrafındakılara nur saçır, hər zaman belə qal. AD GÜNÜN MÜBARƏK BALACA çocuk",
    "Ömür payından gələn hər payızın bahar kimi təravətli, hər qışının isə yay günəşi kimi isti keçməsini diləyirəm. Xoşbəxtlik sənin ən yaxın dostun olsun. AD GÜNÜN MÜBARƏK BALACA çocuk"
  ];

  // API route to generate birthday message
  app.post("/api/generate-greeting", async (req, res) => {
    try {
      const { name = "Balaca" } = req.body;
      const prompt = `Azərbaycan dilində 6 iyul ad günü üçün son dərəcə poetik, dərin mənalı, ruhu oxşayan və səmimi bir təbrik mesajı yaz. Mesaj qısa olsun amma sözlər elə seçilsin ki, oxuyanın qəlbinə toxunsun. Mesajın ən sonuna mütləq böyük hərflərlə "AD GÜNÜN MÜBARƏK BALACA çocuk" cümləsini əlavə et. Heç bir giriş sözü (məs: 'buyurun') yazma, birbaşa təbriklə başla.`;
      
      const interaction = await ai.interactions.create({
        model: "gemini-3.5-flash",
        input: prompt,
      });

      let message = "";
      for (const step of interaction.steps) {
        if (step.type === "model_output") {
          const textContent = step.content?.find((c) => c.type === "text");
          if (textContent && textContent.text) {
            message += textContent.text;
          }
        }
      }
      
      res.json({ message: message.trim() || fallbacks[Math.floor(Math.random() * fallbacks.length)] });
    } catch (error: any) {
      // Quietly handle rate limits by serving a fallback
      if (error?.status !== 429) {
        console.error("Gemini API Error:", error);
      }
      const randomFallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      res.json({ message: randomFallback });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
