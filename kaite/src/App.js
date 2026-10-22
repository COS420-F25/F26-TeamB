import React from 'react';
import './App.css';
import {
  MDBBtn,
  MDBContainer,
  MDBRow,
  MDBCol,
  MDBCard,
  MDBCardBody,
  MDBInput,
  MDBIcon
} from 'mdb-react-ui-kit';
import 'mdb-react-ui-kit/dist/css/mdb.min.css';

const LOCAL_USERS_KEY = 'kaite-local-users';

function readLocalUsers() {
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_USERS_KEY) || '[]');
  } catch {
    return [];
  }
}

async function readFileUsers() {
  const response = await fetch('/credentials.txt');
  if (!response.ok) {
    throw new Error('Unable to load local credentials.');
  }

  const text = await response.text();
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [email, password] = line.split('|');
      return {
        email: email?.trim().toLowerCase(),
        password: password?.trim()
      };
    })
    .filter(({ email, password }) => email && password);
}

function App() {
  const [isSignUp, setIsSignUp] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [message, setMessage] = React.useState('');

  const switchMode = (event) => {
    event.preventDefault();
    setIsSignUp((current) => !current);
    setMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (isSignUp) {
      if (password !== confirmPassword) {
        setMessage('Passwords do not match.');
        return;
      }

      if (readLocalUsers().some((user) => user.email === normalizedEmail)) {
        setMessage('An account with that email already exists.');
        return;
      }

      const users = [...readLocalUsers(), { email: normalizedEmail, password }];
      window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
      setMessage('Account created. You can now log in.');
      setIsSignUp(false);
      setPassword('');
      setConfirmPassword('');
      return;
    }

    try {
      const users = [...(await readFileUsers()), ...readLocalUsers()];
      const isValid = users.some(
        (user) => user.email === normalizedEmail && user.password === password
      );
      setMessage(isValid ? 'Login successful.' : 'Invalid email or password.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <MDBContainer fluid className="login-page">
      <MDBRow className="d-flex justify-content-center align-items-center h-100">
        <MDBCol col="12">
          <MDBCard className="bg-dark text-white my-5 mx-auto login-card">
            <MDBCardBody className="p-5 d-flex flex-column align-items-center mx-auto w-100">
              <h2 className="fw-bold mb-2 text-uppercase">{isSignUp ? 'Sign Up' : 'Login'}</h2>
              <p className="text-white-50 mb-5">
                {isSignUp ? 'Create your account' : 'Please enter your login and password'}
              </p>

              <form className="w-100 d-flex flex-column align-items-center" onSubmit={handleSubmit}>
                <MDBInput
                  wrapperClass="mb-4 mx-5 w-100"
                  labelClass="text-white"
                  label="Email address"
                  id="email-address"
                  type="email"
                  size="lg"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <MDBInput
                  wrapperClass="mb-4 mx-5 w-100"
                  labelClass="text-white"
                  label="Password"
                  id="password"
                  type="password"
                  size="lg"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                {isSignUp && (
                  <MDBInput
                    wrapperClass="mb-4 mx-5 w-100"
                    labelClass="text-white"
                    label="Confirm password"
                    id="confirm-password"
                    type="password"
                    size="lg"
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                )}

                {!isSignUp && (
                  <p className="small mb-3 pb-lg-2">
                    <a className="text-white-50" href="#forgot-password">Forgot password?</a>
                  </p>
                )}
                <MDBBtn type="submit" outline className="mx-2 px-5" color="white" size="lg">
                  {isSignUp ? 'Create account' : 'Login'}
                </MDBBtn>
              </form>

              {message && <p className="small mt-3 mb-0 text-center" role="status">{message}</p>}

              {!isSignUp && <div className="d-flex flex-row mt-3 mb-5">
                <MDBBtn tag="a" color="none" className="m-3" style={{ color: 'white' }} aria-label="Log in with Facebook">
                  <MDBIcon fab icon="facebook-f" size="lg" />
                </MDBBtn>
                <MDBBtn tag="a" color="none" className="m-3" style={{ color: 'white' }} aria-label="Log in with Twitter">
                  <MDBIcon fab icon="twitter" size="lg" />
                </MDBBtn>
                <MDBBtn tag="a" color="none" className="m-3" style={{ color: 'white' }} aria-label="Log in with Google">
                  <MDBIcon fab icon="google" size="lg" />
                </MDBBtn>
              </div>}

              <p className="mb-0">
                {isSignUp ? 'Already have an account? ' : 'Don&apos;t have an account? '}
                <a href={isSignUp ? '#login' : '#sign-up'} onClick={switchMode} className="text-white-50 fw-bold">
                  {isSignUp ? 'Login' : 'Sign Up'}
                </a>
              </p>
            </MDBCardBody>
          </MDBCard>
        </MDBCol>
      </MDBRow>
    </MDBContainer>
  );
}

export default App;
