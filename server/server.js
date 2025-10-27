require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Pre-flight Check for API Key ---
if (!process.env.GEMINI_API_KEY) {
  console.error('FATAL ERROR: GEMINI_API_KEY is not defined in your .env file.');
  process.exit(1); // Exit the process with an error code
}

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- Gemini AI Setup ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- Routes ---

// Health check route to ensure server is running
app.get('/', (req, res) => {
  res.send('AI Solver Server is running!');
});

app.post('/solve', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Image data is required.' });
    }

    const imagePart = {
      inlineData: {
        data: image.split(',')[1],
        mimeType: 'image/png',
      },
    };

    const prompt = "Analyze the attached image which contains a handwritten problem. Provide only the final, precise solution to the problem. Do not explain the steps or add any introductory text. Just the answer.";
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    
    // Check if the model returned a valid text response
    if (!response || !response.text) {
        throw new Error("The AI model did not return a valid response.");
    }

    const text = response.text();
    
    res.json({ solution: text });

  } catch (error) {
    console.error('Error with Gemini API or server processing:', error);
    // Send back a more informative error message if available
    const errorMessage = error.message || 'Failed to process the image due to an internal server error.';
    res.status(500).json({ error: errorMessage });
  }
});

// --- Server Start ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

