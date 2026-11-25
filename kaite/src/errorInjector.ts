/**
 * Settings that control when errors are inserted.
 */
export interface Settings {
  enabled: boolean;
  frequency: number;
  allowedTypes?: string[];
}

/**
 * Information about an error inserted into a response.
 */
export interface InjectedError {
  id: string;
  type: string;
  originalText: string;
  alteredText: string;
  explanation: string;
  startIndex: number;
  endIndex: number;
}

/**
 * The modified response and its error information.
 */
export interface InjectedResponse {
  text: string;
  error?: InjectedError;
}

/**
 * Types of errors supported by the injector.
 */
export const ErrorTypes = [
  'factual',
  'logical',
  'citation',
  'syntax',
  'omission',
] as const;


/**
 * Decides whether an error should be inserted.
 */
export function shouldInject(settings: Settings): boolean {
  if (!settings.enabled) {
    return false;
  }

  if (settings.frequency <= 0) {
    return false;
  }

  if (settings.frequency >= 1) {
    return true;
  }

  return Math.random() < settings.frequency;
}


/**
 * Replaces a known fact with an incorrect one.
 * Returns undefined if no supported fact is found.
 */
function applyFactualError(text: string) {
  const replacements = [
    { correct: 'Paris', incorrect: 'Berlin' },
    { correct: 'Earth', incorrect: 'Mars' },
    { correct: '100 degrees Celsius', incorrect: '50 degrees Celsius' },
  ];

  for (const replacement of replacements) {
    const startIndex = text.indexOf(replacement.correct);

    if (startIndex !== -1) {
      const endIndex = startIndex + replacement.incorrect.length;

      return {
        alteredText:
          text.slice(0, startIndex) +
          replacement.incorrect +
          text.slice(startIndex + replacement.correct.length),
        originalText: replacement.correct,
        insertedText: replacement.incorrect,
        startIndex,
        endIndex,
        explanation: 'A factual detail was changed.',
      };
    }
  }

  return undefined;
}


/**
 * Attempts to insert an error into an AI response.
 */
export function injectError(
  integratedText: string,
  settings: Settings
): InjectedResponse {
  if (!shouldInject(settings)) {
    return { text: integratedText };
  }

  const allowedTypes = settings.allowedTypes ?? [...ErrorTypes];

  if (!allowedTypes.includes('factual')) {
    return { text: integratedText };
  }

  const result = applyFactualError(integratedText);

  if (!result) {
    return { text: integratedText };
  }

  const error: InjectedError = {
    id: `err-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: 'factual',
    originalText: result.originalText,
    alteredText: result.insertedText,
    explanation: result.explanation,
    startIndex: result.startIndex,
    endIndex: result.endIndex,
  };

  return {
    text: result.alteredText,
    error,
  };
}

