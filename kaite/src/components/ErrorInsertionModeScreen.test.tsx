import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorInsertionModeScreen from './ErrorInsertionModeScreen'
import { injectError } from './errorInjector';


// Mock whatever module actually produces the agent's response + injects the error.
// Replace path + exported function name with the real ones.

jest.mock('./errorInjector', () => ({
      injectError: jest.fn(),
}));

describe('ErrorInsertionModeScreen', () => { //!!Needs to be replaced - When errorInjector is actually completed!!
    beforeEach(() => {
        jest.clearAllMocks();
    });

    //Test 1: Agent gives a good response if the User does catch the error
    test('agent gives positive response if the user does catch the error', async () => {
        // Arrange: force the injector to return a response with a known, injected error
        (injectError as jest.Mock).mockReturnValue({
        text: 'The mitochondria is the capital of France.', // planted error
        error: {
            id: 'err-1',
            type: 'factual',
            originalText: 'The mitochondria is the powerhouse of the cell.',
            alteredText: 'The mitochondria is the capital of France.',
            explanation: 'Swapped a fact for an unrelated false statement.',
        },
        });

        render(<ErrorInsertionModeScreen />); //render screen
        

        //Agent responds, gives a planted error
        const agentMessage = await screen.findByText(
        /The mitochondria is the capital of France\./i
        );
        expect(agentMessage).toBeInTheDocument();

        //User catches the error !!WILL NEED TO BE CHANGED WHEN RYAN FINISHES HIS BRANCH!!
        const flagButton = screen.getByRole('button', { name: /flag|this looks wrong/i });
        await userEvent.click(flagButton);

        //Expect: agent to give a positive response that the User caught the error
        const positiveResponse = await screen.findByText(
        /Inserted error caught/i
        );
        expect(positiveResponse).toBeInTheDocument();
    });
    //Test 2: Settings change next response when User changes them mid conversation
    test('settings (difficulty + type of error) do change next turn after User changes them mid conversation', async () => {
        // Arrange: first turn returns a factual error, second turn returns a logical error
        (injectError as jest.Mock)
        .mockReturnValueOnce({
            text: 'The mitochondria is the capital of France.', // planted error (turn 1)
            error: {
            id: 'err-1',
            type: 'factual',
            originalText: 'The mitochondria is the powerhouse of the cell.',
            alteredText: 'The mitochondria is the capital of France.',
            explanation: 'Swapped a fact for an unrelated false statement.',
            },
        })
        .mockReturnValueOnce({
            text: 'All birds can fly, so penguins can fly.', // planted error (turn 2)
            error: {
            id: 'err-2',
            type: 'logical',
            originalText: 'Most birds can fly, but penguins cannot.',
            alteredText: 'All birds can fly, so penguins can fly.',
            explanation: 'Introduced an overgeneralization that leads to a false conclusion.',
            },
        });

        render(<ErrorInsertionModeScreen />); //render screen

        //Agent responds, gives a planted error
        const agentMessage = await screen.findByText(
        /The mitochondria is the capital of France\./i
        );
        expect(agentMessage).toBeInTheDocument();

        //First turn should use the default settings
        expect(injectError).toHaveBeenCalledTimes(1);
        expect(injectError).toHaveBeenLastCalledWith(
        expect.objectContaining({
            difficulty: 'easy',    // !!WILL NEED TO BE CHANGED to the real default!!
            errorType: 'factual',  // !!WILL NEED TO BE CHANGED to the real default!!
        })
        );

        //User catches the error, opts to change agentic settings !!WILL NEED TO BE CHANGED WHEN RYAN FINISHES HIS BRANCH!!
        const flagButton = screen.getByRole('button', { name: /flag|this looks wrong/i });
        await userEvent.click(flagButton);

        const settingsButton = screen.getByRole('button', { name: /settings/i });
        await userEvent.click(settingsButton);

        const difficultySelect = screen.getByLabelText(/difficulty/i);
        await userEvent.selectOptions(difficultySelect, 'hard');

        const errorTypeSelect = screen.getByLabelText(/type of error|error type/i);
        await userEvent.selectOptions(errorTypeSelect, 'logical');

        const saveButton = screen.getByRole('button', { name: /save|apply/i });
        await userEvent.click(saveButton);

        //User continues the conversation so the next turn is generated
        const nextButton = screen.getByRole('button', { name: /next|continue/i });
        await userEvent.click(nextButton);

        //Expect: BOTH settings passed into the next injected response to be the user changed settings
        await waitFor(() => expect(injectError).toHaveBeenCalledTimes(2));
        expect(injectError).toHaveBeenLastCalledWith(
        expect.objectContaining({
            difficulty: 'hard',
            errorType: 'logical',
        })
        );

        //Expect: the next agent message is the one generated under the new settings
        const nextAgentMessage = await screen.findByText(
        /All birds can fly, so penguins can fly\./i
        );
        expect(nextAgentMessage).toBeInTheDocument();
    });


    //Test 3: Agent does not give response when User catches error
    test('agent does not give successful response when the User does not catch an error', async () => {
        // Arrange: force the injector to return a response with a known, injected error
        (injectError as jest.Mock).mockReturnValue({
        text: 'The mitochondria is the capital of France.', // planted error
        error: {
            id: 'err-1',
            type: 'factual',
            originalText: 'The mitochondria is the powerhouse of the cell.',
            alteredText: 'The mitochondria is the capital of France.',
            explanation: 'Swapped a fact for an unrelated false statement.',
        },
        });

        render(<ErrorInsertionModeScreen />); //render screen
        
        //Agent responds, gives a planted error
        const agentMessage = await screen.findByText(
        /The mitochondria is the capital of France\./i
        );
        expect(agentMessage).toBeInTheDocument();

        //User does not catch the error !!WILL NEED TO BE CHANGED WHEN RYAN FINISHES HIS BRANCH!!
        const flagButton = screen.getByRole('button', { name: /flag error/i });
        await userEvent.click(flagButton);

        //Expect: agent to give a positive response that the User caught the error
        const positiveResponse = await screen.findByText(
        /Inserted error caught/i
        );
        expect(positiveResponse).not.toBeInTheDocument();

    });
});


