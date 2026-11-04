import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App, LOCAL_USERS_KEY } from './App';;

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
  userEvent.type(screen.getByLabelText(/email address/i), 'invalid@example.com');
  userEvent.type(screen.getByLabelText(/password/i), 'wrongpassword');
  userEvent.click(screen.getByRole('button', { name: /login/i }));
  expect(await screen.findByRole('status')).toBeInTheDocument();
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