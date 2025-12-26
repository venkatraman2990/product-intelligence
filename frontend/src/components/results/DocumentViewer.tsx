import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  Loader2,
  Search,
} from 'lucide-react';
import { findBestMatch, type MatchResult } from '../../utils/fuzzyMatch';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentViewerProps {
  contractId: string;
  citation: string;
  documentText: string;
  onClose: () => void;
}

export default function DocumentViewer({
  contractId,
  citation,
  documentText,
  onClose,
}: DocumentViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [highlightedText, setHighlightedText] = useState<string>('');
  const [pageTexts, setPageTexts] = useState<string[]>([]);
  const [matchPage, setMatchPage] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const pdfUrl = `/api/contracts/${contractId}/pdf`;

  // Find match in document text
  useEffect(() => {
    if (citation && documentText) {
      const match = findBestMatch(citation, documentText);
      setMatchResult(match);
      if (match) {
        setHighlightedText(match.matchedText);
      }
    }
  }, [citation, documentText]);

  // Extract text from all pages for page-aware matching
  const onDocumentLoadSuccess = useCallback(async (pdf: { numPages: number }) => {
    setNumPages(pdf.numPages);
    setIsLoading(false);

    // Extract text from each page
    const texts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await (pdf as any).getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        texts.push(pageText);
      } catch {
        texts.push('');
      }
    }
    setPageTexts(texts);

    // Find which page contains the match
    if (citation) {
      for (let i = 0; i < texts.length; i++) {
        const match = findBestMatch(citation, texts[i]);
        if (match && match.score >= 0.5) {
          setMatchPage(i + 1);
          setCurrentPage(i + 1);
          break;
        }
      }
    }
  }, [citation]);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('PDF load error:', error);
    setError('Failed to load document. Please try again.');
    setIsLoading(false);
  }, []);

  // Page navigation
  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, numPages));
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page);
    }
  };

  // Zoom controls
  const zoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5));

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        goToPreviousPage();
      } else if (e.key === 'ArrowRight') {
        goToNextPage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, numPages]);

  // Scroll to highlighted text after page renders
  useEffect(() => {
    if (!isLoading && currentPage === matchPage && highlightedText) {
      // Small delay to ensure text layer is rendered
      const timer = setTimeout(() => {
        const container = containerRef.current;
        if (container) {
          const marks = container.querySelectorAll('mark');
          if (marks.length > 0) {
            marks[0].scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
          }
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, currentPage, matchPage, highlightedText]);

  // Custom text renderer for highlighting
  const customTextRenderer = useCallback(
    (textItem: { str: string }) => {
      if (!highlightedText || !textItem.str) return textItem.str;

      const text = textItem.str;
      const highlightLower = highlightedText.toLowerCase();
      const textLower = text.toLowerCase();

      // Check if this text item contains part of the highlighted text
      if (highlightLower.includes(textLower) || textLower.includes(highlightLower.substring(0, 20))) {
        return `<mark style="background-color: #FEF08A; padding: 2px 0;">${text}</mark>`;
      }

      return text;
    },
    [highlightedText]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
    >
      {/* Header */}
      <div
        className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-4"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
      >
        <div className="flex items-center gap-4">
          {/* Page navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousPage}
              disabled={currentPage <= 1}
              className="p-2 rounded-lg text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-white text-sm">
              Page{' '}
              <input
                type="number"
                value={currentPage}
                onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                className="w-12 px-2 py-1 rounded text-center bg-white/10 text-white border-none"
                min={1}
                max={numPages}
              />{' '}
              of {numPages}
            </span>
            <button
              onClick={goToNextPage}
              disabled={currentPage >= numPages}
              className="p-2 rounded-lg text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-2 border-l border-white/20 pl-4">
            <button
              onClick={zoomOut}
              className="p-2 rounded-lg text-white hover:bg-white/10"
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <span className="text-white text-sm w-16 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              className="p-2 rounded-lg text-white hover:bg-white/10"
            >
              <ZoomIn className="h-5 w-5" />
            </button>
          </div>

          {/* Match indicator */}
          {matchPage && (
            <div className="flex items-center gap-2 border-l border-white/20 pl-4">
              <Search className="h-4 w-4 text-yellow-400" />
              <span className="text-yellow-400 text-sm">
                Citation found on page {matchPage}
              </span>
              {currentPage !== matchPage && (
                <button
                  onClick={() => setCurrentPage(matchPage)}
                  className="px-2 py-1 text-xs bg-yellow-500 text-black rounded hover:bg-yellow-400"
                >
                  Go to match
                </button>
              )}
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-white hover:bg-white/10"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Citation info bar */}
      {citation && (
        <div
          className="absolute top-14 left-0 right-0 px-4 py-2"
          style={{ backgroundColor: '#FEF08A' }}
        >
          <div className="flex items-start gap-2">
            <span className="text-sm font-medium text-amber-800">Citation:</span>
            <span className="text-sm text-amber-900 flex-1">{citation}</span>
            {matchResult && (
              <span className="text-xs px-2 py-1 bg-amber-200 rounded text-amber-800">
                {Math.round(matchResult.score * 100)}% match
              </span>
            )}
          </div>
        </div>
      )}

      {/* Document viewer */}
      <div
        ref={containerRef}
        className="absolute overflow-auto"
        style={{
          top: citation ? '6.5rem' : '3.5rem',
          bottom: '0',
          left: '0',
          right: '0',
        }}
      >
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
            <span className="ml-2 text-white">Loading document...</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full">
            <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
            <p className="text-white text-lg">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
            >
              Close
            </button>
          </div>
        )}

        {!error && (
          <div className="flex justify-center py-4" ref={pageRef}>
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              }
            >
              <Page
                pageNumber={currentPage}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                customTextRenderer={customTextRenderer}
                className="shadow-2xl"
              />
            </Document>
          </div>
        )}
      </div>

      {/* Match not found warning */}
      {!isLoading && !matchResult && citation && (
        <div
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg flex items-center gap-2"
          style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}
        >
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-700 text-sm">
            Could not find exact citation match in document
          </span>
        </div>
      )}
    </div>
  );
}
