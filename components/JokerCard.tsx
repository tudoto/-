import React from 'react';
import { Joker } from '../types';

interface JokerCardProps {
  joker: Joker;
  onClick?: () => void;
  canSell?: boolean;
}

const JokerCard: React.FC<JokerCardProps> = ({ joker, onClick, canSell }) => {
  const getRarityColor = () => {
    switch (joker.rarity) {
      case 'Common': return 'bg-blue-500 border-blue-700';
      case 'Uncommon': return 'bg-green-500 border-green-700';
      case 'Rare': return 'bg-yellow-500 border-yellow-700';
      case 'Legendary': return 'bg-purple-600 border-purple-800';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div 
      onClick={onClick}
      className={`
        group relative w-24 h-32 rounded-lg border-b-4 border-r-4 shadow-xl cursor-pointer 
        transition-transform duration-200 hover:scale-105 active:scale-95
        flex flex-col items-center p-2 text-center overflow-hidden
        ${getRarityColor()} text-white
      `}
    >
      <div className="text-xs font-bold uppercase tracking-wider mb-1 opacity-75">{joker.rarity}</div>
      <div className="flex-1 flex items-center justify-center">
        {/* Placeholder Art - In a real app, images would be here */}
        <div className="text-4xl font-black drop-shadow-md select-none">
           J
        </div>
      </div>
      <div className="w-full bg-black/30 rounded p-1">
        <div className="text-xs font-bold truncate leading-tight">{joker.name}</div>
        <div className="hidden group-hover:block absolute inset-0 bg-black/90 p-2 z-10 text-xs text-left overflow-y-auto">
          <p className="font-bold text-white mb-1">{joker.name}</p>
          <p className="text-gray-300">{joker.description}</p>
          <p className="mt-2 text-green-400">${joker.price}</p>
          {canSell && <p className="mt-2 text-red-400 font-bold">Click to SELL: ${Math.floor(joker.price / 2)}</p>}
        </div>
      </div>
    </div>
  );
};

export default JokerCard;
