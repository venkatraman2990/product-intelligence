import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
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

interface HighlightRange {
  start: number;
  end: number;
  matchedText: string;
}

interface SearchMatch {
  pageIndex: number;
  start: number;
  end: number;
  text: string;
}

export default function DocumentViewer({
  contractId,
  citation,
  documentText,
  onClose,
}: DocumentViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.2);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [pageTexts, setPageTexts] = useState<string[]>([]);
  const [matchPage, setMatchPage] = useState<number | null>(null);
  const [pageHighlightRanges, setPageHighlightRanges] = useState<Map<number, HighlightRange>>(new Map());
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set([1]));

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const searchInputRef = useRef<HTMLInputElement>(null);

  const pdfUrl = `/api/contracts/${contractId}/pdf`;

  // Find match in document text
  useEffect(() => {
    if (citation && documentText) {
      const match = findBestMatch(citation, documentText);
      setMatchResult(match);
    }
  }, [citation, documentText]);

  // Extract text from all pages for page-aware matching
  const onDocumentLoadSuccess = useCallback(async (pdf: { numPages: number }) => {
    setNumPages(pdf.numPages);

    // Initialize rendered pages (first few pages)
    const initialPages = new Set<number>();
    for (let i = 1; i <= Math.min(3, pdf.numPages); i++) {
      initialPages.add(i);
    }
    setRenderedPages(initialPages);

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

    // Find which page contains the citation match
    const highlightRanges = new Map<number, HighlightRange>();
    if (citation) {
      for (let i = 0; i < texts.length; i++) {
        const match = findBestMatch(citation, texts[i]);
        if (match && match.score >= 0.5) {
          setMatchPage(i + 1);
          highlightRanges.set(i + 1, {
            start: match.start,
            end: match.end,
            matchedText: match.matchedText,
          });
          // Ensure this page is rendered
          setRenderedPages(prev => new Set([...prev, i + 1]));
          break;
        }
      }
    }
    setPageHighlightRanges(highlightRanges);

    setIsLoading(false);
  }, [citation]);

  // Scroll to citation match after loading
  useEffect(() => {
    if (!isLoading && matchPage && pageRefs.current.has(matchPage)) {
      setTimeout(() => {
        const pageElement = pageRefs.current.get(matchPage);
        pageElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
    }
  }, [isLoading, matchPage]);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('PDF load error:', error);
    setError('Failed to load document. Please try again.');
    setIsLoading(false);
  }, []);

  // Zoom controls
  const zoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5));

  // Search functionality
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const results: SearchMatch[] = [];
    const queryLower = searchQuery.toLowerCase();

    pageTexts.forEach((pageText, index) => {
      const textLower = pageText.toLowerCase();
      let searchStart = 0;

      while (searchStart < textLower.length) {
        const matchIndex = textLower.indexOf(queryLower, searchStart);
        if (matchIndex === -1) break;

        results.push({
          pageIndex: index,
          start: matchIndex,
          end: matchIndex + searchQuery.length,
          text: pageText.substring(matchIndex, matchIndex + searchQuery.length),
        });

        searchStart = matchIndex + 1;
      }
    });

    setSearchResults(results);
    setCurrentSearchIndex(0);
  }, [searchQuery, pageTexts]);

  // Navigate to search result
  const goToSearchResult = (index: number) => {
    if (searchResults.length === 0) return;

    const result = searchResults[index];
    const pageNum = result.pageIndex + 1;

    // Ensure page is rendered
    setRenderedPages(prev => new Set([...prev, pageNum]));

    // Scroll to the page
    setTimeout(() => {
      const pageElement = pageRefs.current.get(pageNum);
      pageElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const goToNextSearchResult = () => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);
    goToSearchResult(nextIndex);
  };

  const goToPrevSearchResult = () => {
    if (searchResults.length === 0) return;
    const prevIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentSearchIndex(prevIndex);
    goToSearchResult(prevIndex);
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isSearchOpen) {
          setIsSearchOpen(false);
          setSearchQuery('');
        } else {
          onClose();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      } else if (e.key === 'Enter' && isSearchOpen) {
        if (e.shiftKey) {
          goToPrevSearchResult();
        } else {
          goToNextSearchResult();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isSearchOpen, searchResults.length, currentSearchIndex]);

  // IntersectionObserver for lazy loading pages
  useEffect(() => {
    if (numPages === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.getAttribute('data-page') || '0');
            if (pageNum > 0) {
              setRenderedPages(prev => new Set([...prev, pageNum]));
            }
          }
        });
      },
      { rootMargin: '200px', threshold: 0.1 }
    );

    pageRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [numPages]);

  // Custom text renderer for highlighting citations and search results
  // Uses direct text matching instead of position tracking for reliability
  const createTextRenderer = useCallback(
    (pageNumber: number) => (textItem: { str: string }) => {
      const text = textItem.str;
      if (!text) return text;

      let result = text;
      const textLower = text.toLowerCase();

      // Check for citation highlight using direct text matching
      const citationRange = pageHighlightRanges.get(pageNumber);
      if (citationRange && citationRange.matchedText) {
        const citationLower = citationRange.matchedText.toLowerCase();

        // Try exact match first (entire citation in one text item)
        const matchIndex = textLower.indexOf(citationLower);
        if (matchIndex !== -1) {
          // Found citation text in this text item
          const before = text.substring(0, matchIndex);
          const match = text.substring(matchIndex, matchIndex + citationRange.matchedText.length);
          const after = text.substring(matchIndex + citationRange.matchedText.length);
          result = `${before}<mark class="citation-highlight" data-citation-start="true">${match}</mark>${after}`;
        } else {
          // PDF splits text into multiple items - check if this item is part of the citation
          // Extract words from the citation for matching
          const citationWords = citationRange.matchedText.split(/[\s,]+/).filter(w => w.length > 0);
          const normalizedText = text.trim();
          const normalizedTextLower = normalizedText.toLowerCase();

          // Check if this text item exactly matches a word or consecutive words from the citation
          // This prevents "SUI01" from matching just because it contains "01"
          for (let i = 0; i < citationWords.length; i++) {
            // Try matching single word
            if (normalizedTextLower === citationWords[i].toLowerCase()) {
              result = `<mark class="citation-highlight">${text}</mark>`;
              break;
            }
            // Try matching consecutive words (e.g., "JULY 01" or "01, 2021")
            for (let j = i + 1; j <= citationWords.length; j++) {
              const phrase = citationWords.slice(i, j).join(' ').toLowerCase();
              const phraseWithComma = citationWords.slice(i, j).join(', ').toLowerCase();
              if (normalizedTextLower === phrase || normalizedTextLower === phraseWithComma) {
                result = `<mark class="citation-highlight">${text}</mark>`;
                break;
              }
            }
            if (result !== text) break;
          }
        }
      }

      // Check for search highlights using direct text matching
      if (searchQuery && searchQuery.length >= 2) {
        const searchLower = searchQuery.toLowerCase();
        let searchIndex = textLower.indexOf(searchLower);

        if (searchIndex !== -1) {
          // Check if this is the active search result
          const pageSearchResults = searchResults.filter(r => r.pageIndex === pageNumber - 1);
          const isActive = pageSearchResults.some((r, idx) => {
            const globalIdx = searchResults.findIndex(
              sr => sr.pageIndex === r.pageIndex && sr.start === r.start
            );
            return globalIdx === currentSearchIndex;
          });

          const className = isActive ? 'search-highlight active' : 'search-highlight';
          const before = text.substring(0, searchIndex);
          const match = text.substring(searchIndex, searchIndex + searchQuery.length);
          const after = text.substring(searchIndex + searchQuery.length);
          result = `${before}<mark class="${className}">${match}</mark>${after}`;
        }
      }

      return result;
    },
    [pageHighlightRanges, searchQuery, searchResults, currentSearchIndex]
  );

  // Page render success callback (no longer resets position tracking)
  const onPageRenderSuccess = useCallback((pageNumber: number) => {
    // No-op - position tracking removed in favor of direct text matching
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
    >
      {/* Header */}
      <div
        className="h-14 flex items-center justify-between px-4 flex-shrink-0"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.95)' }}
      >
        <div className="flex items-center gap-4">
          {/* Page info */}
          <span className="text-white text-sm">
            {numPages} pages
          </span>

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

          {/* Search controls */}
          <div className="flex items-center gap-2 border-l border-white/20 pl-4">
            {isSearchOpen ? (
              <>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search document..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-48 pl-8 pr-3 py-1.5 rounded bg-white/10 text-white text-sm placeholder-white/50 border-none focus:outline-none focus:ring-2 focus:ring-white/30"
                    autoFocus
                  />
                </div>
                {searchResults.length > 0 && (
                  <>
                    <span className="text-white/70 text-sm">
                      {currentSearchIndex + 1} / {searchResults.length}
                    </span>
                    <button
                      onClick={goToPrevSearchResult}
                      className="p-1.5 rounded-lg text-white hover:bg-white/10"
                      title="Previous match (Shift+Enter)"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={goToNextSearchResult}
                      className="p-1.5 rounded-lg text-white hover:bg-white/10"
                      title="Next match (Enter)"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </>
                )}
                {searchQuery && searchResults.length === 0 && (
                  <span className="text-red-400 text-sm">No matches</span>
                )}
                <button
                  onClick={() => {
                    setIsSearchOpen(false);
                    setSearchQuery('');
                  }}
                  className="p-1.5 rounded-lg text-white hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setIsSearchOpen(true);
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white hover:bg-white/10"
                title="Search (Ctrl+F)"
              >
                <Search className="h-4 w-4" />
                <span className="text-sm">Search</span>
              </button>
            )}
          </div>

          {/* Citation match indicator */}
          {matchPage && (
            <div className="flex items-center gap-2 border-l border-white/20 pl-4">
              <span className="text-yellow-400 text-sm">
                Citation on page {matchPage}
              </span>
              <button
                onClick={() => {
                  const pageElement = pageRefs.current.get(matchPage);
                  pageElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="px-2 py-1 text-xs bg-yellow-500 text-black rounded hover:bg-yellow-400"
              >
                Go to citation
              </button>
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
          className="px-4 py-2 flex-shrink-0"
          style={{ backgroundColor: '#FEF08A' }}
        >
          <div className="flex items-start gap-2">
            <span className="text-sm font-medium text-amber-800">Citation:</span>
            <span className="text-sm text-amber-900 flex-1 line-clamp-2">{citation}</span>
            {matchResult && (
              <span className="text-xs px-2 py-1 bg-amber-200 rounded text-amber-800 flex-shrink-0">
                {Math.round(matchResult.score * 100)}% match
              </span>
            )}
          </div>
        </div>
      )}

      {/* Document viewer - scrollable container with all pages */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
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
            <div className="flex flex-col items-center gap-4 py-4">
              {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <div
                  key={pageNum}
                  ref={(el) => {
                    if (el) pageRefs.current.set(pageNum, el);
                  }}
                  data-page={pageNum}
                  className="relative"
                >
                  {/* Page number indicator */}
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/70 rounded text-white text-xs z-10">
                    Page {pageNum}
                  </div>

                  {renderedPages.has(pageNum) ? (
                    <Page
                      pageNumber={pageNum}
                      scale={scale}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      customTextRenderer={createTextRenderer(pageNum)}
                      onRenderSuccess={() => onPageRenderSuccess(pageNum)}
                      className="shadow-2xl"
                    />
                  ) : (
                    <div
                      style={{
                        width: `${595 * scale}px`,
                        height: `${842 * scale}px`,
                        backgroundColor: 'white',
                      }}
                      className="shadow-2xl flex items-center justify-center"
                    >
                      <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Document>
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
