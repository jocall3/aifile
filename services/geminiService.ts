// Copyright James Burvel O’Callaghan III
// President Citibank Demo Business Inc.

import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const generateResponse = async (
  knowledgeContext: string,
  chatHistory: string,
  newUserQuery: string
): Promise<string> => {
  try {
    const model = 'gemini-2.5-flash';

    const systemInstruction = `You are a helpful AI assistant with a specialized knowledge base provided by the user.
- Your knowledge base is provided below, enclosed in "--- START:" and "--- END:" tags.
- The user's previous conversation history is also provided.
- Answer the user's "NEW QUERY" based on the knowledge base and the conversation history.
- If the answer is not in the knowledge base or chat history, say that you don't have information on that topic.
- Be concise and helpful.`;

    const fullPrompt = `${systemInstruction}

--- KNOWLEDGE BASE START ---
${knowledgeContext}
--- KNOWLEDGE BASE END ---

--- CHAT HISTORY START ---
${chatHistory}
--- CHAT HISTORY END ---

NEW QUERY: ${newUserQuery}
`;

    const response = await ai.models.generateContent({
      model: model,
      contents: fullPrompt,
    });
    
    return response.text;
  } catch (error) {
    console.error("Error generating content with Gemini:", error);
    return "I'm sorry, I encountered an error while processing your request.";
  }
};

export const geminiService = {
  generateResponse,
};