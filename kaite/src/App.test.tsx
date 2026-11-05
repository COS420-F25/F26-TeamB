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

/*
Test 2 - User File Selection Cancellation (#215)
Checks that cancelling file selection does not store a new file.
The file upload feature has not been implemented yet.
This test will need to be verified once it is available.
 */
test('does not store a new file when user cancels file selection', () => {
  render(<App />);

  // Find the file upload input
  const fileInput = screen.queryByLabelText(/upload file/i);
  expect(fileInput).not.toBeNull();

  // Record browser stroage before cancellation
  const storageBefore = { ...localStorage };

  // Simulate cancelling file selection
  userEvent.upload(fileInput, []);

  // Verify no file was selected
  expect(fileInput.files).toHaveLength(0);

  // Verify browser storage did not change
  expect({ ...localStorage }).toEqual(storageBefore);
});

