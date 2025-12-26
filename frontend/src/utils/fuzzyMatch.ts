/**
 * Improved fuzzy matching algorithm for citation highlighting.
 * Uses a multi-stage approach for better accuracy.
 */

export interface MatchResult {
  start: number;
  end: number;
  score: number;
  matchedText: string;
}

/**
 * Normalize text by removing extra whitespace and lowercasing.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .trim();
}

/**
 * Generate character n-grams from text.
 */
function generateNgrams(text: string, n: number = 3): Set<string> {
  const ngrams = new Set<string>();
  const normalized = normalizeText(text);
  for (let i = 0; i <= normalized.length - n; i++) {
    ngrams.add(normalized.substring(i, i + n));
  }
  return ngrams;
}

/**
 * Calculate Jaccard similarity between two sets of n-grams.
 */
function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Find longest common subsequence of words.
 */
function lcsWords(words1: string[], words2: string[]): number {
  const m = words1.length;
  const n = words2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (words1[i - 1] === words2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Extract words from text, keeping only alphanumeric content.
 */
function extractWords(text: string): string[] {
  return normalizeText(text)
    .split(/[\s,;:\-\/\(\)\[\]\.]+/)
    .filter(w => w.length >= 2)
    .map(w => w.replace(/[^a-z0-9]/g, ''));
}

/**
 * Stage 1: Exact substring match (score 1.0)
 */
function exactMatch(citation: string, document: string): MatchResult | null {
  const citationLower = citation.toLowerCase();
  const documentLower = document.toLowerCase();
  const index = documentLower.indexOf(citationLower);

  if (index >= 0) {
    return {
      start: index,
      end: index + citation.length,
      score: 1.0,
      matchedText: document.substring(index, index + citation.length),
    };
  }
  return null;
}

/**
 * Stage 2: Normalized exact match (score 0.95)
 */
function normalizedMatch(citation: string, document: string): MatchResult | null {
  const normalizedCitation = normalizeText(citation);
  const normalizedDocument = normalizeText(document);
  const index = normalizedDocument.indexOf(normalizedCitation);

  if (index >= 0) {
    // Find corresponding position in original document
    let originalPos = 0;
    let normalizedPos = 0;

    while (normalizedPos < index && originalPos < document.length) {
      const normalizedChar = normalizeText(document[originalPos]);
      if (normalizedChar.length > 0) {
        normalizedPos++;
      }
      originalPos++;
    }

    // Estimate end position
    const endPos = Math.min(originalPos + citation.length + 20, document.length);

    return {
      start: originalPos,
      end: endPos,
      score: 0.95,
      matchedText: document.substring(originalPos, endPos),
    };
  }
  return null;
}

/**
 * Stage 3: Sliding window with LCS scoring (score 0.6-0.9)
 */
function slidingWindowMatch(citation: string, document: string): MatchResult | null {
  const citationWords = extractWords(citation);
  if (citationWords.length === 0) return null;

  const documentWords = extractWords(document);
  const windowSize = Math.min(citationWords.length * 3, documentWords.length);

  let bestMatch: MatchResult | null = null;
  let bestScore = 0;

  // Build word position index
  const wordPositions: Map<string, number[]> = new Map();
  let charPos = 0;

  for (let i = 0; i < documentWords.length; i++) {
    const word = documentWords[i];
    // Find this word in the original document
    const wordIndex = document.toLowerCase().indexOf(word, charPos);
    if (wordIndex >= 0) {
      if (!wordPositions.has(word)) {
        wordPositions.set(word, []);
      }
      wordPositions.get(word)!.push(wordIndex);
      charPos = wordIndex + word.length;
    }
  }

  // Find positions of first citation word in document
  const firstWord = citationWords[0];
  const startPositions = wordPositions.get(firstWord) || [];

  for (const startPos of startPositions) {
    // Extract window from document
    const windowEnd = Math.min(startPos + citation.length * 2, document.length);
    const windowText = document.substring(startPos, windowEnd);
    const windowWords = extractWords(windowText);

    // Calculate LCS score
    const lcsLength = lcsWords(citationWords, windowWords);
    const score = lcsLength / citationWords.length;

    if (score > bestScore && score >= 0.5) {
      bestScore = score;

      // Find actual matched text boundaries
      const matchedText = windowText.substring(0, Math.min(citation.length * 1.5, windowText.length));

      bestMatch = {
        start: startPos,
        end: startPos + matchedText.length,
        score: 0.6 + (score * 0.3), // Scale to 0.6-0.9
        matchedText,
      };
    }
  }

  return bestMatch;
}

/**
 * Stage 4: N-gram similarity match (score 0.5-0.6)
 */
function ngramMatch(citation: string, document: string): MatchResult | null {
  const citationNgrams = generateNgrams(citation);
  if (citationNgrams.size === 0) return null;

  const windowSize = citation.length * 2;
  let bestMatch: MatchResult | null = null;
  let bestScore = 0;

  // Slide window across document
  for (let i = 0; i < document.length - citation.length; i += Math.floor(citation.length / 4)) {
    const window = document.substring(i, i + windowSize);
    const windowNgrams = generateNgrams(window);
    const similarity = jaccardSimilarity(citationNgrams, windowNgrams);

    if (similarity > bestScore && similarity >= 0.3) {
      bestScore = similarity;
      bestMatch = {
        start: i,
        end: i + Math.min(citation.length * 1.5, window.length),
        score: 0.5 + (similarity * 0.1), // Scale to 0.5-0.6
        matchedText: window.substring(0, Math.min(citation.length * 1.5, window.length)),
      };
    }
  }

  return bestMatch;
}

/**
 * Main fuzzy matching function.
 * Tries multiple strategies in order of precision.
 * Minimum threshold: 0.5 (50% confidence)
 */
export function findBestMatch(
  citation: string,
  document: string,
  minScore: number = 0.5
): MatchResult | null {
  if (!citation || !document) return null;

  // Stage 1: Exact match
  const exact = exactMatch(citation, document);
  if (exact) return exact;

  // Stage 2: Normalized match
  const normalized = normalizedMatch(citation, document);
  if (normalized) return normalized;

  // Stage 3: Sliding window with LCS
  const sliding = slidingWindowMatch(citation, document);
  if (sliding && sliding.score >= minScore) return sliding;

  // Stage 4: N-gram similarity
  const ngram = ngramMatch(citation, document);
  if (ngram && ngram.score >= minScore) return ngram;

  // No match found above threshold
  return null;
}

/**
 * Find match in text layer content (for PDF.js)
 * Returns page number and position within that page's text
 */
export function findMatchInPages(
  citation: string,
  pageTexts: string[]
): { pageIndex: number; match: MatchResult } | null {
  for (let i = 0; i < pageTexts.length; i++) {
    const match = findBestMatch(citation, pageTexts[i]);
    if (match && match.score >= 0.5) {
      return { pageIndex: i, match };
    }
  }
  return null;
}
