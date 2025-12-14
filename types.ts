export type GamePhase = 'LOBBY' | 'CHOOSING_WORD' | 'DRAWING' | 'ROUND_END' | 'GAME_END';

export interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  avatar: string; // Emoji
  hasGuessedCorrectly: boolean;
  isConnected: boolean;
  isNPC?: boolean; // New flag for bots
}

export interface DrawPoint {
  x: number;
  y: number;
}

export interface DrawPath {
  points: DrawPoint[];
  color: string;
  width: number;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  type: 'CHAT' | 'SYSTEM' | 'GUESS_CORRECT';
  timestamp: number;
}

export interface GameState {
  roomId: string;
  phase: GamePhase;
  players: Player[];
  currentDrawerId: string | null;
  currentWord: string;       // Only visible to drawer/host
  currentWordHint: string;   // "3个字"
  timeLeft: number;          // Seconds remaining
  round: number;
  totalRounds: number;
  drawingData: DrawPath[];   // History of strokes
  chatHistory: ChatMessage[];
  wordChoices: string[];     // Choices for drawer
  winnerId: string | null;
}

export interface NetworkMessage {
  type: 'JOIN' | 'WELCOME' | 'UPDATE_STATE' | 'DRAW_ACTION' | 'CLEAR_CANVAS' | 'CHAT_MESSAGE' | 'START_GAME' | 'CHOOSE_WORD' | 'RESTART';
  payload: any;
}

// Poker / Balatro Types
export enum Suit {
  Hearts = 'Hearts',
  Diamonds = 'Diamonds',
  Clubs = 'Clubs',
  Spades = 'Spades'
}

export enum Rank {
  Two = 2, Three = 3, Four = 4, Five = 5, Six = 6, Seven = 7, Eight = 8, Nine = 9, Ten = 10,
  Jack = 11, Queen = 12, King = 13, Ace = 14
}

export enum HandType {
  HighCard = 'High Card',
  Pair = 'Pair',
  TwoPair = 'Two Pair',
  ThreeOfAKind = 'Three of a Kind',
  Straight = 'Straight',
  Flush = 'Flush',
  FullHouse = 'Full House',
  FourOfAKind = 'Four of a Kind',
  StraightFlush = 'Straight Flush',
  RoyalFlush = 'Royal Flush'
}

export interface PlayingCard {
  suit: Suit;
  rank: Rank;
  isSelected?: boolean;
}

export interface ScoredHand {
  handType: HandType;
  scoringCards: PlayingCard[];
  baseChips: number;
  baseMult: number;
}

export interface Joker {
  name: string;
  description: string;
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Legendary';
  price: number;
}