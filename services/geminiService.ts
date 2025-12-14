import { GoogleGenAI } from "@google/genai";
import { Joker, PlayingCard, HandType, Rank, Suit } from "../types";

// Helper to format cards for prompt
const formatCards = (cards: PlayingCard[]) => {
  return cards.map(c => `${Rank[c.rank]} of ${c.suit}`).join(', ');
};

const formatJokers = (jokers: Joker[]) => {
  return jokers.map(j => `${j.name} (${j.description})`).join(', ');
};

export const getJokerAdvice = async (
  hand: PlayingCard[],
  jokers: Joker[],
  blindTarget: number,
  currentScore: number,
  discardsLeft: number,
  handsLeft: number
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "Joker says: I can't help you without an API Key! (Check metadata settings)";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
      You are the Joker from the game Balatro. You are chaotic, witty, but strategically sound.
      
      Current Game State:
      - Target Score to Beat: ${blindTarget}
      - Current Score: ${currentScore}
      - Hands Remaining: ${handsLeft}
      - Discards Remaining: ${discardsLeft}
      
      My Current Hand: [${formatCards(hand)}]
      My Active Jokers: [${formatJokers(jokers)}]
      
      Analyze my hand. Should I play a specific combination or discard? Which cards?
      Do I have any synergies with my Jokers?
      
      Keep the advice short (under 50 words) and speak like a jester.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        maxOutputTokens: 100,
        temperature: 0.8,
      }
    });

    return response.text || "The Joker is silent...";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The void stares back... (API Error)";
  }
};
