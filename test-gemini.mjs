
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-4-hydrogen",
    contents: "Introduce yourself as PosturePet, a friendly ergonomic coach.",
  });

  console.log(response.text);
}

main().catch(console.error);
