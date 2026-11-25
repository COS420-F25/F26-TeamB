import { injectError } from './errorInjector';

// Test 1: Make sure a factual error is inserted when enabled.
test('inserts a factual error when enabled', () => {
  // Start with a response that contains a correct fact.
  const originalText = 'The capital of France is Paris.';

  // Force the injector to insert a factual error.
  const result = injectError(originalText, {
    enabled: true,
    frequency: 1,
    allowedTypes: ['factual'],
  });

  // Check that the fact changed and the error was recorded.
  expect(result.text).toBe('The capital of France is Berlin.');
  expect(result.error).toBeDefined();
  expect(result.error?.type).toBe('factual');
});



// Test 2: Make sure the inserted error's location is recorded correctly.
test('records the correct location of an inserted error', () => {
  // Insert a known factual error.
  const result = injectError('The capital of France is Paris.', {
    enabled: true,
    frequency: 1,
    allowedTypes: ['factual'],
  });

  // Check that the original and incorrect words are stored.
  expect(result.error?.originalText).toBe('Paris');
  expect(result.error?.alteredText).toBe('Berlin');

  // Get the saved starting and ending positions.
  const start = result.error?.startIndex;
  const end = result.error?.endIndex;

  // Make sure both positions were recorded.
  expect(start).toBeDefined();
  expect(end).toBeDefined();

  // Check that the saved positions point to the incorrect word.
  expect(result.text.slice(start!, end!)).toBe('Berlin');
});



// Test 3: Make sure no error is inserted when the feature is disabled.
test('does not insert an error when disabled', () => {
  // Start with a response containing a known fact.
  const originalText = 'The capital of France is Paris.';

  // Turn off error insertion.
  const result = injectError(originalText, {
    enabled: false,
    frequency: 1,
    allowedTypes: ['factual'],
  });

  // Check that the response stays the same.
  expect(result.text).toBe(originalText);

  // Make sure no error information was recorded.
  expect(result.error).toBeUndefined();
});
