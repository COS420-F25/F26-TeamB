import { beforeEach, expect, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App, { LOCAL_USERS_KEY } from './App';

const testUser = { email: 'test-user@test.com', password: 'password1234' };

async function login(): Promise<void> {
  window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify([testUser]));
  await userEvent.type(screen.getByLabelText(/email address/i), testUser.email);
  await userEvent.type(screen.getByLabelText(/^password$/i), testUser.password);
  await userEvent.click(screen.getByRole('button', { name: /^login$/i }));
}

beforeEach(() => {
  window.localStorage.clear();
});

test('renders the login form', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /login/i })).toBeTruthy();
  expect(screen.getByLabelText(/email address/i)).toBeTruthy();
  expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
});

test('opens the sign-up form', async () => {
  render(<App />);
  await userEvent.click(screen.getByRole('link', { name: /sign up/i }));
  expect(screen.getByRole('heading', { name: /sign up/i })).toBeTruthy();
  expect(screen.getByLabelText(/confirm password/i)).toBeTruthy();
});

test('shows an error for invalid login credentials', async () => {
  render(<App />);
  await userEvent.type(screen.getByLabelText(/email address/i), 'invalid@example.com');
  await userEvent.type(screen.getByLabelText(/^password$/i), 'wrongpassword');
  await userEvent.click(screen.getByRole('button', { name: /^login$/i }));
  expect(await screen.findByText(/invalid email or password/i)).toBeTruthy();
});

test('shows the upload page after successful login', async () => {
  render(<App />);
  await login();
  expect(await screen.findByRole('heading', { name: /upload a conversation/i })).toBeTruthy();
  expect(screen.getByText(/login successful/i)).toBeTruthy();
});

test('stores a valid JSON conversation log locally', async () => {
  render(<App />);
  await login();

  const content = JSON.stringify({ messages: [{ text: 'Hello' }] });
  const file = new File([content], 'conversationlog.json', { type: 'application/json' });
  await userEvent.upload(screen.getByLabelText(/upload file/i), file);

  expect(await screen.findByText('conversationlog.json')).toBeTruthy();
  expect(JSON.parse(window.localStorage.getItem('kaite-uploaded-conversations') || '[]')).toEqual([
    { name: 'conversationlog.json', content, size: file.size },
  ]);
});

test('rejects unsupported file types without storing them', async () => {
  render(<App />);
  await login();

  const file = new File(['image'], 'photo.png', { type: 'image/png' });
  await userEvent.upload(screen.getByLabelText(/upload file/i), file, { applyAccept: false });

  expect(await screen.findByText(/file type.*not supported/i)).toBeTruthy();
  expect(screen.queryByText('photo.png')).toBeNull();
  expect(window.localStorage.getItem('kaite-uploaded-conversations')).toBeNull();
});

test('rejects malformed JSON files', async () => {
  render(<App />);
  await login();

  const file = new File(['not json'], 'conversation.json', { type: 'application/json' });
  await userEvent.upload(screen.getByLabelText(/upload file/i), file);

  expect(await screen.findByText(/not valid json/i)).toBeTruthy();
  expect(window.localStorage.getItem('kaite-uploaded-conversations')).toBeNull();
});