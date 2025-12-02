import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Type, Code } from 'lucide-react';

interface InputAreaProps {
  onGenerate: (prompt: string, mode: 'auto' | 'image' | 'code') => void;
  isGenerating: boolean;
}

export const InputArea: React.FC<InputAreaProps> = ({ onGenerate, isGenerating }) => {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'auto' | 'image' | 'code'>('auto');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    onGenerate(prompt, mode);
    setPrompt('');
    
    // Reset height
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [prompt]);

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-neutral-950 via-neutral-950/90 to-transparent z-40 pb-6 pt-12">
      <div className="max-w-3xl mx-auto">
        <div className="relative group rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl shadow-black/50 transition-all focus-within:border-neutral-600 focus-within:ring-1 focus-within:ring-neutral-600">
          
          {/* Mode Selector */}
          <div className="absolute -top-10 left-0 flex space-x-2">
            <button 
              onClick={() => setMode('auto')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${mode === 'auto' ? 'bg-neutral-800 text-white border border-neutral-700' : 'bg-neutral-900/50 text-neutral-500 hover:bg-neutral-800'}`}
            >
              <Type size={12} />
              <span>Auto</span>
            </button>
            <button 
              onClick={() => setMode('image')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${mode === 'image' ? 'bg-purple-900/30 text-purple-300 border border-purple-500/30' : 'bg-neutral-900/50 text-neutral-500 hover:bg-neutral-800'}`}
            >
              <ImageIcon size={12} />
              <span>Image</span>
            </button>
            <button 
              onClick={() => setMode('code')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${mode === 'code' ? 'bg-blue-900/30 text-blue-300 border border-blue-500/30' : 'bg-neutral-900/50 text-neutral-500 hover:bg-neutral-800'}`}
            >
              <Code size={12} />
              <span>Code</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col relative">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={mode === 'image' ? "Describe an image to generate..." : "What do you want to create?"}
              className="w-full bg-transparent text-white placeholder-neutral-500 px-5 py-4 min-h-[60px] max-h-[200px] resize-none focus:outline-none text-base"
              rows={1}
            />
            <div className="flex justify-between items-center px-4 pb-3">
               <div className="text-xs text-neutral-600 font-medium">
                  {mode === 'image' ? 'Gemini 2.5 Flash Image' : 'Gemini 2.5 Flash'}
               </div>
               <button 
                type="submit"
                disabled={!prompt.trim() || isGenerating}
                className={`p-2 rounded-xl transition-all duration-200 ${
                    prompt.trim() && !isGenerating
                    ? 'bg-white text-black hover:bg-neutral-200 shadow-lg shadow-white/10' 
                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                }`}
               >
                 {isGenerating ? (
                   <div className="w-5 h-5 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin" />
                 ) : (
                   <Send size={20} />
                 )}
               </button>
            </div>
          </form>
        </div>
        <p className="text-center text-neutral-600 text-[10px] mt-2">
           Press Return to send. Shift+Return for new line.
        </p>
      </div>
    </div>
  );
};