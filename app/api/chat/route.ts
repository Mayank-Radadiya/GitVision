import { GoogleGenerativeAI } from "@google/generative-ai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = messages.map((m: any) => `${m.role}: ${m.content}`).join("\n");

  const result = await model.generateContent(prompt);

  const responseText = result.response.text();

  return new Response(JSON.stringify({ text: responseText }), {
    headers: { "Content-Type": "application/json" },
  });
}
