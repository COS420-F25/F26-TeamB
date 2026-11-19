// errorInjector.ts

/**
 * Settings controlling how/whether errors get injected into AI responses.
 * Shape inferred from ReflectionChatScreen's `settings: ErrorSettings` state —
 * adjust fields to match whatever User6238/User8618 actually defined.
 */
export interface Settings {
  enabled: boolean;
  frequency: number; // e.g. 0.0 - 1.0, probability an error gets injected
  allowedTypes?: string[]; // subset of ErrorTypes to restrict injection to
}

/**
 * A single injected error, describing what was changed and why.
 */
export interface InjectedError {
  id: string;
  type: string;
  originalText: string;
  alteredText: string;
  explanation: string;
}

/**
 * The result returned from injectError — the (possibly) modified text,
 * plus metadata about the error if one was inserted.
 */
export interface InjectedResponse {
  text: string;
  error?: InjectedError;
}

/**
 * The set of error categories this injector knows how to produce.
 * Replace/extend with whatever categories were agreed on (e.g. factual,
 * logical, citation, code-syntax, etc.)
 */
export const ErrorTypes: string[] = [
  'factual',
  'logical',
  'citation',
  'syntax',
  'omission',
];

/**
 * Decides whether an error should be injected this turn, based on settings.
 */
export function shouldInject(settings: Settings): boolean {
  if (!settings.enabled) return false;
  return Math.random() < settings.frequency;
}

/**
 * Given the AI's integrated/finalized response text and the current
 * settings, optionally injects an error into the text and returns both
 * the resulting text and metadata describing the injected error (if any).
 */
export function injectError(
  integratedText: string,
  settings: Settings
): InjectedResponse {
  if (!shouldInject(settings)) {
    return { text: integratedText };
  }

  const candidateTypes =
    settings.allowedTypes && settings.allowedTypes.length > 0
      ? settings.allowedTypes
      : ErrorTypes;

  const type =
    candidateTypes[Math.floor(Math.random() * candidateTypes.length)];

  // Placeholder: actual alteration logic would depend on `type`
  // (e.g. swap a fact, flip a logical operator, mangle a citation, etc.)
  const { alteredText, explanation, originalText } = applyError(
    integratedText,
    type
  );

  const error: InjectedError = {
    id: crypto.randomUUID(),
    type,
    originalText,
    alteredText,
    explanation,
  };

  return { text: alteredText, error };
}

/**
 * Stub for the actual per-type error-generation logic. Each case should
 * return the specific original/altered snippet and a human-readable
 * explanation of what was changed, for use in evaluation/feedback later.
 */
function applyError(
  text: string,
  type: string
): { originalText: string; alteredText: string; explanation: string } {
  switch (type) {
    case 'factual':
      // TODO: swap a fact/entity in the text
      return {
        originalText: text,
        alteredText: text, // placeholder — replace with real mutation
        explanation: 'A factual detail was altered.',
      };
    case 'logical':
      return {
        originalText: text,
        alteredText: text,
        explanation: 'A logical inconsistency was introduced.',
      };
    case 'citation':
      return {
        originalText: text,
        alteredText: text,
        explanation: 'A citation/source reference was altered or fabricated.',
      };
    case 'syntax':
      return {
        originalText: text,
        alteredText: text,
        explanation: 'A code syntax error was introduced.',
      };
    case 'omission':
      return {
        originalText: text,
        alteredText: text,
        explanation: 'Important information was omitted.',
      };
    default:
      return {
        originalText: text,
        alteredText: text,
        explanation: 'Unknown error type.',
      };
  }
}
