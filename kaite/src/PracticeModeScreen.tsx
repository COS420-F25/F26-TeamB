import React from 'react';
import { WeflectFlow } from './WeFlectComponents/react/WeflectFlow';
import { createWeflectServer } from './WeFlectComponents/server/weflectServer';
import { injectError, InjectedResponse } from './errorInjector';

// Allows the user to return to the main dashboard.
interface PracticeModeScreenProps {
  screenSetter: React.Dispatch<React.SetStateAction<number>>;
}

// Example responses that can have factual errors inserted.
const practiceResponses = [
  'The capital of France is Paris.',
  'Earth is the third planet from the Sun.',
  'Water boils at 100 degrees Celsius at sea level.',
];

const practiceServer = createWeflectServer();

function PracticeModeScreen({
  screenSetter,
}: PracticeModeScreenProps): React.JSX.Element {
  // Store the practice response and whether the answer is visible.
  const [response, setResponse] = React.useState<InjectedResponse | null>(null);
  const [showAnswer, setShowAnswer] = React.useState(false);
  const [showAIConversation, setShowAIConversation] = React.useState(false); 

  // Pick a random response and insert a factual error.
  const startPractice = (): void => {
    const originalText =
      practiceResponses[Math.floor(Math.random() * practiceResponses.length)];

    const result = injectError(originalText, {
      enabled: true,
      frequency: 1,
      allowedTypes: ['factual'],
    });

    setResponse(result);
    setShowAnswer(false);
  };

  return (
    <div className="container mt-5">
      <h2>Practice Spotting AI Errors</h2>

      <p>
        Read the AI response and try to identify the mistake
        before revealing the answer.
      </p>

      {/* Start a new practice question. */}
      <button
        type="button"
        className="btn btn-primary me-2"
        onClick={startPractice}
      >
        Generate Practice Response
      </button>
      <button
        type="button"
        className="btn btn-success me-2"
        onClick={() => setShowAIConversation(true)}
        >
        Start AI Practice Conversation
       </button>
      {/* Return to the main dashboard. */}
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => screenSetter(1)}
      >
        Back to Dashboard
      </button>

      {/* Show the response after the user starts practicing. */}
      {response && (
        <div className="card mt-4">
          <div className="card-body">
            <h5>AI Response</h5>
            <p>{response.text}</p>

            {/* Let the user check the inserted error. */}
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={() => setShowAnswer(true)}
            >
              Reveal Error
            </button>

            {/* Show the correct answer when requested. */}
            {showAnswer && (
              <div className="mt-3">
                {response.error ? (
                  <>
                    <p>
                      <strong>Incorrect text:</strong>{' '}
                      {response.error.alteredText}
                    </p>
                    <p>
                      <strong>Correct text:</strong>{' '}
                      {response.error.originalText}
                    </p>
                    <p>{response.error.explanation}</p>
                  </>
                ) : (
                  <p>No error was inserted.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {showAIConversation && (
        <WeflectFlow server={practiceServer} practiceMode={true} />
    )}
    </div>
  );
}

export default PracticeModeScreen;