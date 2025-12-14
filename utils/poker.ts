import { HandType, PlayingCard, Rank, ScoredHand, Suit } from '../types';
import { HAND_BASE_SCORES } from '../constants';

// Helper to get value for sorting
const getRankValue = (rank: Rank): number => Number(rank);

export const evaluateHand = (cards: PlayingCard[], handLevels: Record<HandType, any>): ScoredHand => {
  if (cards.length === 0) {
    return {
      handType: HandType.HighCard,
      scoringCards: [],
      baseChips: 0,
      baseMult: 0,
    };
  }

  // Sort by rank descending
  const sorted = [...cards].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank));

  // Utils
  const isFlush = cards.length >= 5 && cards.every(c => c.suit === cards[0].suit);
  
  // Straight Check
  let isStraight = false;
  if (cards.length >= 5) {
    const uniqueRanks = Array.from(new Set(sorted.map(c => getRankValue(c.rank))));
    if (uniqueRanks.length >= 5) {
      // Check for consecutive in any 5-window
      for(let i = 0; i <= uniqueRanks.length - 5; i++) {
        const window = uniqueRanks.slice(i, i+5);
        if (window[0] - window[4] === 4) {
          isStraight = true;
          break;
        }
      }
      // Ace low straight (A, 5, 4, 3, 2) -> A=14, 5,4,3,2
      if (!isStraight && uniqueRanks.includes(14) && uniqueRanks.includes(2) && uniqueRanks.includes(3) && uniqueRanks.includes(4) && uniqueRanks.includes(5)) {
        isStraight = true;
      }
    }
  }

  // Count Frequencies
  const counts: Record<string, number> = {};
  sorted.forEach(c => {
    counts[c.rank] = (counts[c.rank] || 0) + 1;
  });
  const freqs = Object.values(counts).sort((a, b) => b - a);

  let type = HandType.HighCard;
  let scoringCards: PlayingCard[] = [];

  // Determine Type
  if (isFlush && isStraight) {
    // Royal check
    const hasAce = sorted.some(c => c.rank === Rank.Ace);
    const hasKing = sorted.some(c => c.rank === Rank.King);
    type = (hasAce && hasKing) ? HandType.RoyalFlush : HandType.StraightFlush;
    scoringCards = sorted; // All 5
  } else if (freqs[0] === 4) {
    type = HandType.FourOfAKind;
    // Get the quad
    const quadRank = Object.keys(counts).find(r => counts[r] === 4);
    scoringCards = sorted.filter(c => String(c.rank) === quadRank);
  } else if (freqs[0] === 3 && freqs[1] >= 2) {
    type = HandType.FullHouse;
    scoringCards = sorted;
  } else if (isFlush) {
    type = HandType.Flush;
    scoringCards = sorted; // All 5
  } else if (isStraight) {
    type = HandType.Straight;
    scoringCards = sorted; // All 5
  } else if (freqs[0] === 3) {
    type = HandType.ThreeOfAKind;
    const tripRank = Object.keys(counts).find(r => counts[r] === 3);
    scoringCards = sorted.filter(c => String(c.rank) === tripRank);
  } else if (freqs[0] === 2 && freqs[1] === 2) {
    type = HandType.TwoPair;
    const pairRanks = Object.keys(counts).filter(r => counts[r] === 2);
    scoringCards = sorted.filter(c => pairRanks.includes(String(c.rank)));
  } else if (freqs[0] === 2) {
    type = HandType.Pair;
    const pairRank = Object.keys(counts).find(r => counts[r] === 2);
    scoringCards = sorted.filter(c => String(c.rank) === pairRank);
  } else {
    type = HandType.HighCard;
    // Only the highest card scores in High Card technically, but in Balatro typically only the card itself triggers things.
    // However, for base chips/mult logic, we treat the 'scoring cards' as the ones that make the hand.
    scoringCards = [sorted[0]];
  }

  // Calculate Base
  const level = handLevels[type];
  const baseScore = HAND_BASE_SCORES[type];
  
  // Level scaling: +5 chips, +0.5 mult per level (simplified)
  const chips = baseScore.chips + (level.level - 1) * 10;
  const mult = baseScore.mult + (level.level - 1) * 1;

  return {
    handType: type,
    scoringCards,
    baseChips: chips,
    baseMult: mult,
  };
};

export const getCardScore = (card: PlayingCard): number => {
  // 2-10 = value, JQK = 10, A = 11
  const r = Number(card.rank);
  if (r <= 10) return r;
  if (r >= 11 && r <= 13) return 10; // J, Q, K
  if (r === 14) return 11; // Ace
  return 0;
};
