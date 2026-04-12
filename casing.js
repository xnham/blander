/**
 * Normalize neutralized headline casing to match the original headline's style.
 * The model sometimes returns all-lowercase or partial casing; this layer enforces
 * sentence case or title case deterministically from the original.
 */

(function () {
  const SMALL_WORDS = new Set([
    'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'if', 'in', 'nor',
    'of', 'off', 'on', 'or', 'out', 'per', 'so', 'the', 'to', 'up', 'via', 'yet',
    'is', 'it', 'be', 'are', 'was', 'were'
  ]);

  /** Words that usually start instructional / question-style title-case headlines */
  const TITLE_FIRST_WORD_HINTS = new Set([
    'how', 'what', 'why', 'when', 'where', 'who', 'which', 'can', 'do', 'does',
    'did', 'is', 'are', 'was', 'were', 'should', 'will', 'would', 'could',
    'your', 'quiz', 'flashback'
  ]);

  function firstAlphaIndex(s) {
    const m = s.match(/[A-Za-z\u00C0-\u024F]/);
    return m ? s.indexOf(m[0]) : -1;
  }

  function wordLetters(word) {
    const m = word.match(/[A-Za-z\u00C0-\u024F]+/);
    return m ? m[0] : '';
  }

  function inferCasingStyle(original) {
    const trimmed = (original || '').trim();
    if (!trimmed) return 'sentence';

    const words = trimmed.split(/\s+/);
    let capped = 0;
    for (const w of words) {
      const letters = wordLetters(w);
      if (!letters) continue;
      const first = letters[0];
      if (first >= 'A' && first <= 'Z') {
        if (letters.length >= 2 && letters === letters.toUpperCase()) {
          capped++;
          continue;
        }
        capped++;
      }
    }
    return capped >= 2 ? 'title' : 'sentence';
  }

  function countCapitalizedWords(text) {
    const words = text.trim().split(/\s+/);
    let n = 0;
    for (const w of words) {
      const letters = wordLetters(w);
      if (!letters) continue;
      if (letters[0] === letters[0].toUpperCase()) n++;
    }
    return n;
  }

  /** True when the model output clearly ignored capitalization */
  function needsCasingFix(neutralized) {
    const t = (neutralized || '').trim();
    if (!t) return false;
    if (t === t.toLowerCase()) return true;
    const i = firstAlphaIndex(t);
    if (i === -1) return false;
    const c = t.charAt(i);
    return c === c.toLowerCase();
  }

  /**
   * Title original but neutral looks like "How to plan..." (only first word capped or similar).
   * Skips sentence-style rewrites that start with an article ("A woman asks...").
   */
  function shouldRefineTitleCase(original, neutralized) {
    if (inferCasingStyle(original) !== 'title') return false;
    const words = neutralized.trim().split(/\s+/);
    if (words.length < 3) return false;
    if (countCapitalizedWords(neutralized) >= 2) return false;

    const firstWord = wordLetters(words[0]).toLowerCase();
    if (!firstWord) return false;
    if (TITLE_FIRST_WORD_HINTS.has(firstWord)) return true;
    return false;
  }

  function capitalizeSegment(segment) {
    if (!segment) return '';
    const i = firstAlphaIndex(segment);
    if (i === -1) return segment;
    return (
      segment.slice(0, i) +
      segment.charAt(i).toLocaleUpperCase('en-US') +
      segment.slice(i + 1).toLowerCase()
    );
  }

  function capitalizeWord(word) {
    return word
      .split('-')
      .map((part) => capitalizeSegment(part))
      .join('-');
  }

  function toSentenceCase(text) {
    let s = text.toLowerCase();
    let i = firstAlphaIndex(s);
    if (i >= 0) {
      s = s.slice(0, i) + s.charAt(i).toLocaleUpperCase('en-US') + s.slice(i + 1);
    }
    s = s.replace(/([.!?])\s+([a-z\u00E0-\u024F])/g, (_, punct, letter) => {
      return punct + ' ' + letter.toLocaleUpperCase('en-US');
    });
    return s;
  }

  function baseForSmallCheck(word) {
    return wordLetters(word).toLowerCase();
  }

  function toTitleCase(text) {
    const words = text.trim().replace(/\s+/g, ' ').split(' ');
    if (words.length === 0) return '';
    const last = words.length - 1;
    return words
      .map((w, idx) => {
        const base = baseForSmallCheck(w);
        const isEdge = idx === 0 || idx === last;
        if (!isEdge && base && SMALL_WORDS.has(base)) {
          return w.toLowerCase();
        }
        return capitalizeWord(w);
      })
      .join(' ');
  }

  /**
   * When the model returns all-lowercase (or leading lowercase), map title-style
   * originals to sentence vs title case. Article-led rewrites ("a woman asks…")
   * stay sentence case; "how to…", "your…", "quiz…" get title case.
   */
  function casingFixForTitleOriginal(neutralized) {
    const words = neutralized.trim().split(/\s+/);
    const firstWord = wordLetters(words[0] || '').toLowerCase();
    if (firstWord === 'a' || firstWord === 'an') {
      return toSentenceCase(neutralized);
    }
    if (TITLE_FIRST_WORD_HINTS.has(firstWord)) {
      return toTitleCase(neutralized);
    }
    if (words.length >= 10) {
      return toSentenceCase(neutralized);
    }
    return toTitleCase(neutralized);
  }

  function applyCasingFromOriginal(original, neutralized) {
    if (neutralized == null || neutralized === '') return neutralized;
    if (!original || !original.trim()) return neutralized;

    const style = inferCasingStyle(original);

    if (needsCasingFix(neutralized)) {
      if (style === 'sentence') {
        return toSentenceCase(neutralized);
      }
      return casingFixForTitleOriginal(neutralized);
    }

    if (style === 'title' && shouldRefineTitleCase(original, neutralized)) {
      return toTitleCase(neutralized);
    }

    return neutralized;
  }

  self.applyCasingFromOriginal = applyCasingFromOriginal;
})();
