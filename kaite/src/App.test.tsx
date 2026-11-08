import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App, { LOCAL_CONVERSATIONS_KEY, LOCAL_USERS_KEY } from './App';

const testUser = { email: 'test-user@test.com', password: 'password1234' };

beforeEach(() => {
  window.localStorage.clear();
});

async function login() {
  const user = userEvent.setup();
  window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify([testUser]));
  await user.type(screen.getByLabelText(/email address/i), testUser.email);
  await user.type(screen.getByLabelText(/^password$/i), testUser.password);
  await user.click(screen.getByRole('button', { name: /^login$/i }));
  return user;
}

test('renders the login form', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
});

test('opens the sign-up form', async () => {
  render(<App />);
  await userEvent.click(screen.getByRole('link', { name: /sign up/i }));
  expect(screen.getByRole('heading', { name: /sign up/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
});
test('displays error message for invalid login', async () => {
  render(<App />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/email address/i), 'invalid@example.com');
  await user.type(screen.getByLabelText(/^password$/i), 'wrongpassword');
  await user.click(screen.getByRole('button', { name: /^login$/i }));
  expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
});

test('shows the upload mockup after successful login', async () => {
  render(<App />);
  await login();
  expect(await screen.findByRole('heading', { name: /import your ai chats/i })).toBeInTheDocument();
});

test('stores valid JSON files locally from the mockup upload control', async () => {
  render(<App />);
  const user = await login();
  const content = JSON.stringify({ messages: [{ text: 'Hello' }] });
  const file = new File([content], 'conversationlog.json', { type: 'application/json' });

  await user.upload(screen.getByLabelText(/choose files to upload/i), file);

  expect(await screen.findByText('conversationlog.json')).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem(LOCAL_CONVERSATIONS_KEY) || '[]')).toEqual([
    { name: 'conversationlog.json', content, size: file.size },
  ]);
});

test('rejects unsupported and malformed files without storing them', async () => {
  render(<App />);
  const user = await login();
  await user.upload(
    screen.getByLabelText(/choose files to upload/i),
    new File(['not json'], 'conversation.json', { type: 'application/json' }),
  );
  expect(await screen.findByText(/not valid json/i)).toBeInTheDocument();
  expect(window.localStorage.getItem(LOCAL_CONVERSATIONS_KEY)).toBeNull();

  fireEvent.change(screen.getByLabelText(/choose files to upload/i), {
    target: { files: [new File(['image'], 'photo.png', { type: 'image/png' })] },
  });
  expect(await screen.findByText(/unsupported file type/i)).toBeInTheDocument();
  expect(window.localStorage.getItem(LOCAL_CONVERSATIONS_KEY)).toBeNull();
});
