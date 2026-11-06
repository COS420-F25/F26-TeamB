
import React from 'react';
import './App.css';
import {DragEvent,useState} from "react";
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

export const LOCAL_USERS_KEY: string = 'kaite-local-users';
export const LOCAL_CONVERSATIONS_KEY: string = 'kaite-uploaded-conversations';

interface UploadedConversation {
  name: string;
  content: string;
  size?: number;
}

function readUploadedConversations(): UploadedConversation[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(LOCAL_CONVERSATIONS_KEY) || '[]');
    if (!Array.isArray(stored)) {
      return [];
    }

    return stored.filter(
      (conversation): conversation is UploadedConversation =>
        typeof conversation?.name === 'string' && typeof conversation?.content === 'string'
    );
  } catch {
    return [];
  }
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('File contents could not be read as text.'));
      }
    };
    reader.onerror = () => reject(new Error('File could not be read.'));
    reader.readAsText(file);
  });
}

interface User {
    email: string,
    password: string
}

function readLocalUsers(): User[] {
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_USERS_KEY) || '[]');
  } catch {
    return [];
  }
}

function App(): React.JSX.Element {
  const [isSignUp, setIsSignUp] = React.useState<boolean>(false);
  const [email, setEmail] = React.useState<string>('');
  const [password, setPassword] = React.useState<string>('');
  const [confirmPassword, setConfirmPassword] = React.useState<string>('');
  const [message, setMessage] = React.useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = React.useState<boolean>(false);

  const switchMode = (event: React.MouseEvent<HTMLAnchorElement>): void => {
    event.preventDefault();
    setIsSignUp((current: boolean) => !current);
    setMessage('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const normalizedEmail: string = email.trim().toLowerCase();

    if (isSignUp) {
      if (password !== confirmPassword) {
        setMessage('Passwords do not match.');
        return;
      }

      if (readLocalUsers().some((user: User) => user.email === normalizedEmail)) {
        setMessage('An account with that email already exists.');
        return;
      }

      const users: User[] = [...readLocalUsers(), { email: normalizedEmail, password }];
      window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
      setMessage('Account created. You can now log in.');
      setIsSignUp(false);
      setPassword('');
      setConfirmPassword('');
      return;
    }

    const isValid: boolean = readLocalUsers().some(
      (user: User) => user.email === normalizedEmail && user.password === password
    );
    if (isValid) {
      setMessage('Login successful.');
      setIsLoggedIn(true);
    } else {
      setMessage('Invalid email or password.');
    }
  };

  if (isLoggedIn) {
    return <FileDrop message={message} onLogout={() => setIsLoggedIn(false)} />;
  }

  return (
    // annoying bruteforce fix for the input text color
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
                  className="text-white"
                  id="email-address"
                  type="email"
                  size="lg"
                  required
                  value={email}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
                />
                <MDBInput
                  wrapperClass="mb-4 mx-5 w-100"
                  labelClass="text-white"
                  label="Password"
                  className="text-white"
                  id="password"
                  type="password"
                  size="lg"
                  required
                  value={password}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
                />
                {isSignUp && (
                  <MDBInput
                    wrapperClass="mb-4 mx-5 w-100"
                    labelClass="text-white"
                    label="Confirm password"
                    className="text-white"
                    id="confirm-password"
                    type="password"
                    size="lg"
                    required
                    value={confirmPassword}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(event.target.value)}
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
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
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
interface FileDropProps {
  message: string;
  onLogout: () => void;
}

export function FileDrop({ message, onLogout }: FileDropProps): React.JSX.Element {
  const [isOver, setIsOver] = useState(false);
  const [files, setFiles] = useState<Array<{ name: string; size?: number }>>(
    () => readUploadedConversations().map(({ name, size }) => ({ name, size })),
  );
  const [uploadMessage, setUploadMessage] = useState<string>('');

  const processFiles = async (selectedFiles: File[]): Promise<void> => {
    for (const file of selectedFiles) {
      if (!file.name.toLowerCase().endsWith('.json')) {
        setUploadMessage('File type not supported. Please select a .json conversation log.');
        continue;
      }

      try {
        const content = await readFileAsText(file);
        JSON.parse(content);

        const conversations = readUploadedConversations();
        const uploadedConversation = { name: file.name, content, size: file.size };
        window.localStorage.setItem(
          LOCAL_CONVERSATIONS_KEY,
          JSON.stringify([...conversations, uploadedConversation]),
        );
        setFiles((current) => [...current, { name: file.name, size: file.size }]);
        setUploadMessage(`${file.name} uploaded successfully.`);
      } catch {
        setUploadMessage(`${file.name} is not valid JSON or could not be saved.`);
      }
    }
  };

  // Define the event handlers
  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsOver(false);
    void processFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <MDBContainer fluid className="login-page upload-page">
      <MDBRow className="d-flex justify-content-center align-items-center min-vh-100">
        <MDBCol col="12">
          <MDBCard className="bg-dark text-white my-5 mx-auto upload-card">
            <MDBCardBody className="p-4 p-md-5 d-flex flex-column align-items-center">
              <MDBIcon far icon="file-alt" size="3x" className="mb-3 text-white-50" />
              <h2 className="fw-bold mb-2 text-uppercase">Upload a conversation</h2>
              <p className="text-white-50 text-center mb-4">
                Choose a .json conversation log to get started.
              </p>

              {message && <p className="small text-center" role="status">{message}</p>}

              <label
                htmlFor="conversation-upload"
                className={`upload-dropzone ${isOver ? 'upload-dropzone-active' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <MDBIcon fas icon="cloud-upload-alt" size="2x" className="mb-2" />
                <span className="fw-bold">Drag and drop your file here</span>
                <span className="text-white-50 small">or click to browse (JSON only)</span>
                <input
                  id="conversation-upload"
                  className="upload-file-input"
                  type="file"
                  accept=".json,application/json"
                  multiple
                  aria-label="Upload file"
                  onChange={(event) => {
                    void processFiles(Array.from(event.currentTarget.files ?? []));
                    event.currentTarget.value = '';
                  }}
                />
              </label>

              {uploadMessage && <p className="small mt-3 mb-0 text-center" role="status">{uploadMessage}</p>}

              {files.length > 0 && (
                <div className="w-100 mt-4">
                  <h3 className="h6">Saved conversation logs</h3>
                  <ul className="upload-file-list mb-0">
                    {files.map((file, index) => (
                      <li key={`${file.name}-${index}`}>
                        <span>{file.name}</span>
                        {typeof file.size === 'number' && (
                          <span className="text-white-50 small">{Math.ceil(file.size / 1024)} KB</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <MDBBtn type="button" outline color="white" className="mt-4" onClick={onLogout}>
                Log out
              </MDBBtn>
            </MDBCardBody>
          </MDBCard>
        </MDBCol>
      </MDBRow>
    </MDBContainer>
  );
}
export default App;