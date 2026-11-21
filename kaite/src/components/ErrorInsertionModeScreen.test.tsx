import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorInsertionModeScreen from './ErrorInsertionModeScreen'
import { injectError } from './errorInjector';


// Mock whatever module actually produces the agent's response + injects the error.
// Replace path + exported function name with the real ones.

jest.mock('../utils/errorInjector', () => ({
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
    test('settings do change next turn after User changes them mid conversation', () => {
        render(<ErrorInsertionModeScreen />);

        //Agent responds, gives a planted error

        //User catches the error, opts to change agentic settings

        //Expect: settings type passed into <ErrorInsertionModeScreen /> to be changed to the user changed settings

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


