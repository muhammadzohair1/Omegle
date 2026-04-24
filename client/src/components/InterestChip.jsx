import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Gamepad2, Coffee } from 'lucide-react';

const CATEGORIES = {
  Study: { 
    icon: BookOpen, 
    subOptions: ['Math', 'Science', 'History', 'Language', 'Computer Science', 'General Grade School', 'University'],
    gradient: 'from-emerald-500 to-teal-500',
  },
  Gaming: { 
    icon: Gamepad2, 
    subOptions: ['FPS', 'MOBA', 'RPG', 'Casual', 'Minecraft', 'Roblox', 'League of Legends'],
    gradient: 'from-purple-500 to-pink-500',
  },
  Casual: { 
    icon: Coffee, 
    subOptions: ['Movies', 'Music', 'Anime', 'Sports', 'Memes', 'Just Chatting', 'Tech'],
    gradient: 'from-orange-500 to-red-500',
  },
};

const InterestChip = ({ 
  category, 
  isSelected, 
  onClick,
}) => {
  const { icon: Icon, gradient } = CATEGORIES[category] || {};
  
  return (
    <motion.button
      onClick={onClick}
      className={`
        relative p-4 rounded-2xl border-2 transition-all duration-300
        ${isSelected 
          ? 'border-transparent shadow-lg shadow-indigo-500/25' 
          : 'border-white/10 bg-white/5 hover:border-white/20'
        }
      `}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Gradient background when selected */}
      {isSelected && (
        <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${gradient} opacity-20 -z-10`} />
      )}
      
      {/* Gradient border effect */}
      {isSelected && (
        <div className={`absolute inset-0 rounded-xl p-[2px] -z-10`}>
          <div className={`w-full h-full rounded-xl bg-gradient-to-br ${gradient}`} />
        </div>
      )}
      
      <div className="flex flex-col items-center gap-2">
        <Icon 
          size={32} 
          className={isSelected ? `text-transparent bg-clip-text bg-gradient-to-br ${gradient}` : 'text-slate-400'} 
        />
        <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-400'}`}>
          {category}
        </span>
      </div>
    </motion.button>
  );
};

const SubOptionChip = ({ option, isSelected, onClick }) => {
  return (
    <motion.button
      onClick={onClick}
      className={`
        relative px-4 py-2 rounded-full border-2 transition-all duration-300
        ${isSelected 
          ? 'border-indigo-500 bg-indigo-500/20' 
          : 'border-white/10 bg-white/5 hover:border-white/20'
        }
      `}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-400'}`}>
        {option}
      </span>
      
      {/* Checkmark when selected */}
      {isSelected && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center"
        >
          <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
          </svg>
        </motion.span>
      )}
    </motion.button>
  );
};

export { InterestChip, SubOptionChip };
export default InterestChip;