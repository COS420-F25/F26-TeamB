import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App, { LOCAL_USERS_KEY } from './App';

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
  userEvent.type(screen.getByLabelText(/email address/i), 'invalid@example.com');
  userEvent.type(screen.getByLabelText(/password/i), 'wrongpassword');
  userEvent.click(screen.getByRole('button', { name: /login/i }));
  expect(await screen.findByRole('status')).toBeInTheDocument();
});
test('browser stores selected json file', async () => {
  render(<App />);
  const user = userEvent.setup();
  // log-in and go to Reflection Conversation screen from main dashboard
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify([{email: "test-user@test.com", password: "password1234"}]));
  user.type(screen.getByLabelText(/email address/i), 'test-user@test.com');
  user.type(screen.getByLabelText(/password/i), 'password1234');
  user.click(screen.getByRole('button', { name: /login/i }));
  user.click(await screen.findByLabelText(/reflection conversation/i));

  // create test JSON file to upload
  const fakeLog: string = JSON.stringify({
    timestamp: '11/03/2026-15:08',
    prompts: ['how many r in strawberry?'],
    responses: []
  })
  const file: File = new File([fakeLog], 'conversationlog.json', {type: 'text/json'});

  // not sure if .upload() clicks the upload button or if it's *just* for managing file selection
  user.upload(screen.getByLabelText(/upload file/i), file);

  // check `conversationlog.json` was selected and uploaded to localStorage
  expect(await screen.findByText('conversationlog.json')).toBeInTheDocument();
  // don't know the exact structure we're going to use for storing the conversation logs, so this may need to be adjusted slightly
  expect(localStorage.getItem('kaite-uploaded-conversations')).toContain(fakeLog);
});
