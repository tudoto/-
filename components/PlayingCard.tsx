import React from 'react';
import { PlayingCard as CardType, Suit, Rank } from '../types';
import { Heart, Diamond, Club, Spade } from 'lucide-react';

interface PlayingCardProps {
  card: CardType;
  onClick?: () => void;
  className?: string;
}

const PlayingCard: React.FC<PlayingCardProps> = ({ card, onClick, className = '' }) => {
  
  const getSuitIcon = () => {
    switch (card.suit) {
      case Suit.Hearts: return <Heart className="w-4 h-4 fill-current" />;
      case Suit.Diamonds: return <Diamond className="w-4 h-4 fill-current" />;
      case Suit.Clubs: return <Club className="w-4 h-4 fill-current" />;
      case Suit.Spades: return <Spade className="w-4 h-4 fill-current" />;
    }
  };

  const getRankDisplay = () => {
    switch (card.rank) {
      case Rank.Jack: return 'J';
      case Rank.Queen: return 'Q';
      case Rank.King: return 'K';
      case Rank.Ace: return 'A';
      default: return String(card.rank);
    }
  };

  const isRed = card.suit === Suit.Hearts || card.suit === Suit.Diamonds;
  const textColor = isRed ? 'text-red-600' : 'text-slate-900';
  const borderColor = card.isSelected ? 'border-orange-500 -translate-y-6 shadow-orange-500/50' : 'border-slate-300 hover:-translate-y-2';

  return (
    <div 
      onClick={onClick}
      className={`
        relative w-20 h-28 bg-white rounded-lg border-2 shadow-lg cursor-pointer 
        transition-all duration-200 select-none flex flex-col justify-between p-1
        ${textColor} ${borderColor} ${className}
      `}
    >
      {/* Top Left */}
      <div className="flex flex-col items-center leading-none">
        <span className="font-bold text-lg">{getRankDisplay()}</span>
        {getSuitIcon()}
      </div>

      {/* Center Big Icon */}
      <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
        {React.cloneElement(getSuitIcon() as React.ReactElement<any>, { className: 'w-12 h-12 fill-current' })}
      </div>

      {/* Bottom Right (Inverted) */}
      <div className="flex flex-col items-center leading-none rotate-180">
        <span className="font-bold text-lg">{getRankDisplay()}</span>
        {getSuitIcon()}
      </div>
      
      {/* Selection Glow (Inner) */}
      {card.isSelected && (
        <div className="absolute inset-0 bg-orange-500/20 rounded-md pointer-events-none" />
      )}
    </div>
  );
};

export default PlayingCard;
