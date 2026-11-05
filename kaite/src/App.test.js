import { render, screen } from '@testing-library/react';
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
  userEvent.type(screen.getByLabelText(/email address/i), 'invalid@example.com');
  userEvent.type(screen.getByLabelText(/password/i), 'wrongpassword');
  userEvent.click(screen.getByRole('button', { name: /login/i }));
  expect(await screen.findByRole('status')).toBeInTheDocument();
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