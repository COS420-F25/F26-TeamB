import { beforeEach, expect, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorInsertionModeScreen from './ErrorInsertionModeScreen'


//Test 1: Agent gives a good response if the User does catch the error
test('agent gives positive response if the user does catch the error', () => {
    render(<ErrorInsertionModeScreen />);
    //User types message, engages with agent

    //Agent responds, gives a planted error

    //User catches the error

    //Expect: agent to give a positive response that the User caught the error

});


//Test 2: Settings change next response when User changes them mid conversation
test('settings do change next turn after User changes them mid conversation', () => {
    render(<ErrorInsertionModeScreen />);

    //Agent responds, gives a planted error

    //User catches the error, opts to change agentic settings

    //Expect: settings type passed into <ErrorInsertionModeScreen /> to be changed to the user changed settings

});

//Test 3: Agent does not give response when User catches error
test('agent does not give successful response when the User does not catch an error', () => {
    render(<ErrorInsertionModeScreen />);
    //User types message, engages with agent

    //Agent responds, gives a planted error

    //User does not catch the error

    //Expect: Agent does not give a positive response that the User caught an error

});