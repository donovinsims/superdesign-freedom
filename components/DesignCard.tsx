import React, { useState } from 'react';
import { ContentType, DesignElement } from '../types';
import { Copy, Maximize2, X, Download, Code2, Type as TypeIcon, Image as ImageIcon } from 'lucide-react';

interface DesignCardProps {
  element: DesignElement;
  onDelete: (id: string) => void;
}

export const DesignCard: React.FC<DesignCardProps> = ({ element, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(element.content);
  };

  const downloadImage = () => {
    if (element.type !== ContentType.IMAGE) return;
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${element.content}`;
    link.download = `superdesign-${element.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getIcon = () => {
    switch(element.type) {
      case ContentType.CODE: return <Code2 size={16} className="text-blue-400" />;
      case ContentType.IMAGE: return <ImageIcon size={16} className="text-purple-400" />;
      default: return <TypeIcon size={16} className="text-emerald-400" />;
    }
  };

  return (
    <div 
      className={`group relative bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden transition-all duration-300 hover:border-neutral-700 hover:shadow-2xl ${expanded ? 'fixed inset-4 z-50 flex flex-col' : 'w-full mb-6'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-900/50 backdrop-blur-sm border-b border-neutral-800/50">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-md bg-neutral-800">
            {getIcon()}
          </div>
          <span className="text-sm font-medium text-neutral-200 truncate max-w-[200px]">
            {element.title || 'Untitled Design'}
          </span>
        </div>
        
        <div className={`flex items-center space-x-1 transition-opacity duration-200 ${isHovered || expanded ? 'opacity-100' : 'opacity-0'}`}>
          <button onClick={copyToClipboard} className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors" title="Copy Content">
            <Copy size={16} />
          </button>
          
          {element.type === ContentType.IMAGE && (
             <button onClick={downloadImage} className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors" title="Download Image">
              <Download size={16} />
            </button>
          )}

          <button onClick={() => setExpanded(!expanded)} className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors" title={expanded ? "Minimize" : "Maximize"}>
            <Maximize2 size={16} />
          </button>
          
          {!expanded && (
            <button onClick={() => onDelete(element.id)} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-md transition-colors" title="Delete">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={`relative ${expanded ? 'flex-1 overflow-auto p-8' : 'p-5'}`}>
        {element.type === ContentType.IMAGE ? (
          <div className="flex items-center justify-center w-full h-full min-h-[200px] bg-black/20 rounded-lg overflow-hidden">
            <img 
              src={`data:image/png;base64,${element.content}`} 
              alt={element.prompt} 
              className={`object-contain ${expanded ? 'max-h-full' : 'max-h-[400px] w-full'}`}
            />
          </div>
        ) : element.type === ContentType.CODE ? (
          <div className="relative font-mono text-sm">
             <div className="absolute top-0 right-0 text-xs text-neutral-500 bg-neutral-800 px-2 py-1 rounded-bl-md">
                {element.metadata?.language}
             </div>
             <pre className="whitespace-pre-wrap text-blue-200 overflow-x-auto">
               <code>{element.content}</code>
             </pre>
          </div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <p className="whitespace-pre-wrap leading-relaxed text-neutral-300">
              {element.content}
            </p>
          </div>
        )}
      </div>

      {/* Footer / Prompt Info */}
      <div className="px-4 py-2 bg-neutral-950/30 border-t border-neutral-800/50">
        <p className="text-xs text-neutral-500 font-mono truncate">
          Prompt: {element.prompt}
        </p>
      </div>
    </div>
  );
};