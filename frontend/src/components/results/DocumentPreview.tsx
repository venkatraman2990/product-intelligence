import { useEffect, useRef } from 'react';
import { X, FileText } from 'lucide-react';

interface DocumentPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  documentText: string;
  highlightText: string;
  fieldName: string;
}

export default function DocumentPreview({
  isOpen,
  onClose,
  documentText,
  highlightText,
  fieldName,
}: DocumentPreviewProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isOpen && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [isOpen, highlightText]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const renderHighlightedText = () => {
    if (!highlightText || !documentText) {
      return <span>{documentText}</span>;
    }

    const normalizedHighlight = highlightText.toLowerCase().trim();
    const normalizedDocument = documentText.toLowerCase();
    
    const index = normalizedDocument.indexOf(normalizedHighlight);
    
    if (index === -1) {
      const words = highlightText.split(/\s+/).filter(w => w.length > 4);
      if (words.length > 0) {
        const firstWord = words[0].toLowerCase();
        const wordIndex = normalizedDocument.indexOf(firstWord);
        if (wordIndex !== -1) {
          const contextStart = Math.max(0, wordIndex - 50);
          const contextEnd = Math.min(documentText.length, wordIndex + highlightText.length + 50);
          
          return (
            <>
              <span>{documentText.slice(0, contextStart)}</span>
              <span
                ref={highlightRef}
                className="px-1 py-0.5 rounded"
                style={{ backgroundColor: '#FEF08A', color: '#854D0E' }}
              >
                {documentText.slice(contextStart, contextEnd)}
              </span>
              <span>{documentText.slice(contextEnd)}</span>
            </>
          );
        }
      }
      return (
        <div>
          <div 
            className="mb-4 p-3 rounded-lg text-sm"
            style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
          >
            Could not find exact match for citation. Showing full document.
            <br />
            <strong>Citation text:</strong> "{highlightText}"
          </div>
          <span>{documentText}</span>
        </div>
      );
    }

    const before = documentText.slice(0, index);
    const match = documentText.slice(index, index + highlightText.length);
    const after = documentText.slice(index + highlightText.length);

    return (
      <>
        <span>{before}</span>
        <span
          ref={highlightRef}
          className="px-1 py-0.5 rounded"
          style={{ backgroundColor: '#FEF08A', color: '#854D0E', fontWeight: 600 }}
        >
          {match}
        </span>
        <span>{after}</span>
      </>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-xl shadow-2xl"
        style={{ backgroundColor: 'white' }}
      >
        <div 
          className="px-5 py-4 flex items-center justify-between border-b shrink-0"
          style={{ borderColor: 'var(--slate-200)' }}
        >
          <div className="flex items-center">
            <FileText className="h-5 w-5 mr-3" style={{ color: 'var(--accelerant-blue)' }} />
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--slate-900)' }}>
                Document Preview
              </h2>
              <p className="text-sm" style={{ color: 'var(--slate-500)' }}>
                Source for: {fieldName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-slate-100"
            style={{ color: 'var(--slate-400)' }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div 
          ref={contentRef}
          className="flex-1 overflow-auto p-6"
          style={{ backgroundColor: 'var(--slate-50)' }}
        >
          <div 
            className="p-5 rounded-lg text-sm leading-relaxed whitespace-pre-wrap font-mono"
            style={{ 
              backgroundColor: 'white', 
              color: 'var(--slate-700)',
              border: '1px solid var(--slate-200)'
            }}
          >
            {renderHighlightedText()}
          </div>
        </div>

        <div 
          className="px-5 py-3 border-t shrink-0 flex justify-end"
          style={{ borderColor: 'var(--slate-200)' }}
        >
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
