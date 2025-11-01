const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

async function main() {
  const response = await genAI.models.generateContent({
    model: "gemini-2.5-flash",
    prompt: "How does AI work?",
  });
  console.log(response.text);
}

(async () => {
  try {
    await main();
  } catch (error) {
    console.error("Error generating content:", error);
  }
})();
