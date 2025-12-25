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

  // Find the best matching substring using sliding window with word overlap scoring
  const findBestMatch = (citation: string, document: string): { start: number; end: number; score: number } | null => {
    const normalizedCitation = citation.toLowerCase().trim();
    const normalizedDoc = document.toLowerCase();
    
    // First, try exact match
    const exactIndex = normalizedDoc.indexOf(normalizedCitation);
    if (exactIndex !== -1) {
      return { start: exactIndex, end: exactIndex + citation.length, score: 1.0 };
    }
    
    // Extract meaningful tokens from citation (words, state codes, numbers)
    // Split on whitespace, commas, semicolons, colons, and hyphens/slashes (as delimiters)
    const citationTokens = normalizedCitation
      .split(/[\s,;:\-\/]+/)
      .map(t => t.replace(/[^a-z0-9]/g, ''))
      .filter(t => t.length >= 2);
    
    if (citationTokens.length === 0) {
      return null;
    }
    
    // Find all positions where citation tokens appear in the document
    const tokenPositions: { token: string; pos: number }[] = [];
    for (const token of citationTokens) {
      let pos = 0;
      while (pos < normalizedDoc.length) {
        const idx = normalizedDoc.indexOf(token, pos);
        if (idx === -1) break;
        // Check word boundaries to avoid partial matches (allow hyphens/slashes as boundaries)
        const beforeOk = idx === 0 || /[\s,;:\-\/\(\)\.]/.test(normalizedDoc[idx - 1]);
        const afterOk = idx + token.length >= normalizedDoc.length || 
                        /[\s,;:\-\/\(\)\.]/.test(normalizedDoc[idx + token.length]);
        if (beforeOk && afterOk) {
          tokenPositions.push({ token, pos: idx });
        }
        pos = idx + 1;
      }
    }
    
    if (tokenPositions.length === 0) {
      return null;
    }
    
    // Group nearby token matches and score each region
    const windowSize = citation.length * 2;
    let bestMatch: { start: number; end: number; score: number } | null = null;
    
    // Sort by position
    tokenPositions.sort((a, b) => a.pos - b.pos);
    
    // Slide through document looking for clusters of matching tokens
    for (let i = 0; i < tokenPositions.length; i++) {
      const windowStart = tokenPositions[i].pos;
      const windowEnd = windowStart + windowSize;
      
      // Count unique tokens in this window
      const tokensInWindow = new Set<string>();
      let lastPos = windowStart;
      
      for (const tp of tokenPositions) {
        if (tp.pos >= windowStart && tp.pos < windowEnd) {
          tokensInWindow.add(tp.token);
          lastPos = Math.max(lastPos, tp.pos + tp.token.length);
        }
      }
      
      // Score = ratio of citation tokens found in this window
      const score = tokensInWindow.size / citationTokens.length;
      
      // Require at least 30% of tokens to match to consider it valid
      if (score >= 0.3 && (!bestMatch || score > bestMatch.score)) {
        // Expand window slightly for context
        const contextPadding = 20;
        const start = Math.max(0, windowStart - contextPadding);
        const end = Math.min(document.length, lastPos + contextPadding);
        bestMatch = { start, end, score };
      }
    }
    
    return bestMatch;
  };

  const renderHighlightedText = () => {
    if (!highlightText || !documentText) {
      return <span>{documentText}</span>;
    }

    const match = findBestMatch(highlightText, documentText);
    
    if (!match || match.score < 0.3) {
      return (
        <div>
          <div 
            className="mb-4 p-3 rounded-lg text-sm"
            style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
          >
            Could not find matching text in document for this citation.
            <br />
            <strong>Expected text:</strong> "{highlightText.length > 200 ? highlightText.slice(0, 200) + '...' : highlightText}"
          </div>
          <span>{documentText}</span>
        </div>
      );
    }

    const before = documentText.slice(0, match.start);
    const highlighted = documentText.slice(match.start, match.end);
    const after = documentText.slice(match.end);

    return (
      <>
        <span>{before}</span>
        <span
          ref={highlightRef}
          className="px-1 py-0.5 rounded"
          style={{ backgroundColor: '#FEF08A', color: '#854D0E', fontWeight: 600 }}
        >
          {highlighted}
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
