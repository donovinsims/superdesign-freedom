import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { InputArea } from './components/InputArea';
import { DesignCard } from './components/DesignCard';
import { DesignElement } from './types';
import { generateCreativeContent } from './services/geminiService';
import { Boxes, Ghost } from 'lucide-react';

const App: React.FC = () => {
  const [elements, setElements] = useState<DesignElement[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load from local storage on mount (simple persistence)
  useEffect(() => {
    const saved = localStorage.getItem('superdesign_elements');
    if (saved) {
      try {
        setElements(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saved elements");
      }
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    localStorage.setItem('superdesign_elements', JSON.stringify(elements));
  }, [elements]);

  const handleGenerate = async (prompt: string, mode: 'auto' | 'image' | 'code') => {
    setIsGenerating(true);
    setError(null);
    try {
      const newElement = await generateCreativeContent(prompt, mode);
      setElements(prev => [newElement, ...prev]);
    } catch (err: any) {
      console.error(err);
      setError("Failed to generate content. Please check your API key and try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = (id: string) => {
    setElements(prev => prev.filter(el => el.id !== id));
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white pb-32">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Error Toast */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-red-200 text-sm flex items-center justify-between animate-fade-in">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="hover:text-white"><Ghost size={16}/></button>
          </div>
        )}

        {/* Empty State */}
        {elements.length === 0 && !isGenerating && (
          <div className="flex flex-col items-center justify-center py-24 text-neutral-700 space-y-4">
             <div className="p-4 bg-neutral-900 rounded-2xl shadow-inner border border-neutral-800">
               <Boxes size={48} className="text-neutral-800" />
             </div>
             <div className="text-center">
                <h3 className="text-xl font-semibold text-neutral-400">Your Canvas is Empty</h3>
                <p className="text-sm max-w-xs mt-2 text-neutral-600">
                  Type anything below to start generating designs, code, or images.
                </p>
             </div>
          </div>
        )}

        {/* Loading Ghost Card */}
        {isGenerating && (
          <div className="mb-6 bg-neutral-900 border border-neutral-800 rounded-xl p-6 animate-pulse">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-neutral-800 rounded-md"></div>
              <div className="h-4 bg-neutral-800 rounded w-1/3"></div>
            </div>
            <div className="space-y-3">
              <div className="h-3 bg-neutral-800 rounded w-full"></div>
              <div className="h-3 bg-neutral-800 rounded w-5/6"></div>
              <div className="h-3 bg-neutral-800 rounded w-4/6"></div>
            </div>
          </div>
        )}

        {/* Feed */}
        <div className="space-y-6">
          {elements.map(element => (
            <DesignCard 
              key={element.id} 
              element={element} 
              onDelete={handleDelete} 
            />
          ))}
        </div>
      </main>

      <InputArea onGenerate={handleGenerate} isGenerating={isGenerating} />
    </div>
  );
};

export default App;