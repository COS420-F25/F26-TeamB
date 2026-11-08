import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

test('renders the login form', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
});

test('opens the sign-up form', () => {
  render(<App />);
  userEvent.click(screen.getByRole('link', { name: /sign up/i }));
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
test('displays a message for an invalid file type', async () => {
  window.localStorage.setItem(
    'kaite-local-users',
    JSON.stringify([{ email: 'test-user@test.com', password: 'password1234' }]),
  );
  render(<App />);

  await userEvent.type(screen.getByLabelText(/email address/i), 'test-user@test.com');
  await userEvent.type(screen.getByLabelText(/password/i), 'password1234');
  await userEvent.click(screen.getByRole('button', { name: /login/i }));
  expect(await screen.findByText(/login successful/i)).toBeInTheDocument();
  const file = new File(['image'], 'photo.png', {type: 'image/png'});
  await userEvent.upload(screen.getByLabelText(/upload file/i), file);
  expect(
    await screen.findByText(/(png|file type).*not supported/i),
  ).toBeInTheDocument();
});
  // not sure if .upload() clicks the upload button or if it's *just* for managing file selection
  user.upload(screen.getByLabelText(/upload file/i), file);

  // check `conversationlog.json` was selected and uploaded to localStorage
  expect(await screen.findByText('conversationlog.json')).toBeInTheDocument();
  // don't know the exact structure we're going to use for storing the conversation logs, so this may need to be adjusted slightly
  expect(localStorage.getItem('kaite-uploaded-conversations')).toContain(fakeLog);
});
test('browser does not store a file when user inputted invalid type', async () => {
  render(<App />);
  const user = userEvent.setup();
  // log-in and go to Reflection Conversation screen from main dashboard
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify([{email: "test-user@test.com", password: "password1234"}]));
  user.type(screen.getByLabelText(/email address/i), 'test-user@test.com');
  user.type(screen.getByLabelText(/password/i), 'password1234');
  user.click(screen.getByRole('button', { name: /login/i }));
  user.click(await screen.findByLabelText(/reflection conversation/i));

    //creates a dummy file to upload into the website
  const file = new File(['image'], 'photo.png', {type: 'image/png'});

  user.upload(screen.getByLabelText(/upload file/i), file);

  //Checking if photo.png is in the document
  expect(screen.queryByText('photo.png')).not.toBeInTheDocument();
  //Using a vairation of Stephen's expect statement, might need to be slightly changed depending on implementation
  expect(localStorage.getItem('kaite-uploaded-conversations')).not.toContain(file);
});
