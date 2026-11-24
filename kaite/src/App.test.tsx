import { beforeEach, expect, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LOCAL_USERS_KEY } from './LoginScreen';

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

test('shows the main dashboard after successful login', async () => {
  const user = userEvent.setup({ applyAccept: false });
  render(<App />);
  await login(user);
  expect(await screen.findByRole('button', { name: /reflection conversation/i })).toBeTruthy();
  expect(screen.getByText(/login successful/i)).toBeTruthy();
});

test('stores a valid JSON conversation log locally', async () => {
  const user = userEvent.setup({ applyAccept: false });
  render(<App />);
  await login(user);
  await userEvent.click(await screen.findByRole('button', { name: /reflection conversation/i }));

  const content = JSON.stringify({ messages: [{ text: 'Hello' }] });
  const file = new File([content], 'conversationlog.json', { type: 'application/json' });
  await userEvent.upload(screen.getByLabelText(/choose file/i), file);

  expect(await screen.findByText('conversationlog.json')).toBeTruthy();
  expect(JSON.parse(window.localStorage.getItem('kaite-uploaded-conversations') || '[]')).toEqual([
    { name: 'conversationlog.json', content, size: file.size },
  ]);
});

test('rejects unsupported file types without storing them', async () => {
  const user = userEvent.setup({ applyAccept: false });
  render(<App />);
  await login(user);
  await user.click(await screen.findByRole('button', { name: /reflection conversation/i }));

  const file = new File(['image'], 'photo.png', { type: 'image/png' });
  await user.upload(screen.getByLabelText(/choose file/i), file);

  expect(await screen.findByText(/unsupported file type/i)).toBeTruthy();
  expect(screen.queryByText('photo.png')).toBeNull();
  expect(window.localStorage.getItem('kaite-uploaded-conversations')).toBeNull();
});

test('rejects malformed JSON files', async () => {
  const user = userEvent.setup({ applyAccept: false });
  render(<App />);
  await login(user);
  await userEvent.click(await screen.findByRole('button', { name: /reflection conversation/i }));

  const file = new File(['not json'], 'conversation.json', { type: 'application/json' });
  await userEvent.upload(screen.getByLabelText(/choose file/i), file);

  expect(await screen.findByText(/not valid json/i)).toBeTruthy();
  expect(window.localStorage.getItem('kaite-uploaded-conversations')).toBeNull();
});