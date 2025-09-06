import nlp from 'compromise';

export function preprocessTextForSignLanguage(sentence) {
  const original = sentence.trim().toLowerCase();
  let doc = nlp(original);

  // Try to extract SOV (subject-object-verb)
  let subject = doc.nouns().eq(0).out('text');
  let verb = doc.verbs().toInfinitive().out('text');
  let object = doc.nouns().eq(1).out('text');

  let isNegative = doc.has('#Negative');
  let questionWord = extractQuestionWord(original);

  let simplified = [];

  if (subject && verb) {
    simplified = [subject];
    if (object) simplified.push(object);
    if (isNegative) simplified.push('not');
    simplified.push(verb);
    if (questionWord) simplified.push(questionWord);
  }

  // If simplified is empty → fallback to naive tokenization
  if (simplified.length === 0) {
    simplified = fallbackSimplify(original, questionWord, isNegative);
  }

  // Always keep original tokens too
  const originalTokens = original
    .replace(/[.,!?]/g, '')
    .split(' ')
    .filter(w => w.trim());

  return {
    simplified,       // simplified tokens for sign-language output
    originalTokens    // backup words for matching CSVs
  };
}

// Naive fallback
function fallbackSimplify(sentence, questionWord, isNegative) {
  const removeWords = [
    'is', 'am', 'are', 'the', 'a', 'an', 'of', 'to',
    'and', 'in', 'on', 'do', 'does', 'did', 'have', 'has'
  ];
  const negatives = ['not', 'never', "don't", "doesn't", "didn't", "can't", "won't"];

  let words = sentence.replace(/[.,!?]/g, '').split(' ');
  let result = words.filter(w => !removeWords.includes(w));

  // Handle negation
  let neg = result.find(w => negatives.includes(w));
  if (neg) {
    result = result.filter(w => w !== neg);
    result.push('not');
  }

  if (questionWord) result.push(questionWord);

  return result;
}

function extractQuestionWord(sentence) {
  const qWords = ['what', 'where', 'who', 'when', 'why', 'how'];
  for (let word of qWords) {
    if (sentence.toLowerCase().startsWith(word)) return word;
  }
  return '';
}


