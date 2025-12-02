import React from 'react';
import { Sparkles, Command } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-neutral-950/80 border-b border-neutral-800">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-white">SuperDesign <span className="font-light text-neutral-400">Freedom</span></h1>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center px-3 py-1.5 bg-neutral-900 rounded-full border border-neutral-800">
            <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>
            <span className="text-xs font-medium text-neutral-400">Gemini Active</span>
          </div>
          <a href="#" className="p-2 text-neutral-400 hover:text-white transition-colors">
            <Command size={20} />
          </a>
        </div>
      </div>
    </header>
  );
};