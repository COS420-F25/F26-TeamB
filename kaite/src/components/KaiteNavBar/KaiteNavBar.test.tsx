import { beforeEach, expect, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { LOCAL_USERS_KEY } from '../../screens/Login/LoginScreen';

const testUser = { email: 'test-user@test.com', password: 'password1234' };

async function login(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify([testUser]));
    await user.type(screen.getByLabelText(/email address/i), testUser.email);
    await user.type(screen.getByLabelText(/^password$/i), testUser.password);
    await user.click(screen.getByRole('button', { name: /^login$/i }));
}

beforeEach(() => {
    window.localStorage.clear();
});

test('renders the navbar', async () => {
    // setup
    render(<App />);
    const user = userEvent.setup();
    await login(user);
    // assertion
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /chat history/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /goals/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /settings/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /log out/i })).toBeTruthy();
});

test('clicking the Dashboard button goes to the main dashboard screen', async () => {
    // setup
    render(<App />);
    const user = userEvent.setup();
    await login(user);
    await user.click(await screen.findByRole('button', { name: /reflection conversation/i })); // Go to the upload logs screen so the main dashboard isn't already rendered
    // user action
    await user.click(screen.getByRole('link', {name: /dashboard/i}));
    // assertion
    expect(await screen.findByRole('button', { name: /reflection conversation/i })).toBeTruthy();
});

test('clicking the Goals button goes to the user goals screen', async () => {
    // setup
    render(<App />);
    const user = userEvent.setup();
    await login(user);
    // user action
    await user.click(screen.getByRole('link', {name: /goals/i}));
    // assertion
    expect(screen.getByRole('heading', { name: /your goals/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /create new goal/i })).toBeTruthy();
});

test('clicking the Log Out button goes to the login screen', async () => {
    // setup
    render(<App />);
    const user = userEvent.setup();
    await login(user);
    // user action
    await user.click(screen.getByRole('link', {name: /log out/i}));
    // assertion
    expect(screen.getByRole('heading', { name: /login/i })).toBeTruthy();
    expect(screen.getByLabelText(/email address/i)).toBeTruthy();
    expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
});
