
import React from 'react';
import './App.css';
import './WeFlectComponents/styles/kaite.css';
import LoginScreen from './LoginScreen';
import MainDashboardScreen from './MainDashboardScreen';
import UploadAILogScreen from './UploadAILogScreen';
import 'mdb-react-ui-kit/dist/css/mdb.min.css';
import { WeflectFlow } from "./WeFlectComponents/react/WeflectFlow";
import { createWeflectServer } from "./WeFlectComponents/server/weflectServer";

export const LOCAL_USERS_KEY: string = 'kaite-local-users';

const server = createWeflectServer(); // POSTs to /api/session and /api/message on this origin

interface UploadedConversation {
  name: string;
  content: string;
  size?: number;
}

function readUploadedConversations(): UploadedConversation[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem('kaite-uploaded-conversations') || '[]');
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
  const [message, setMessage] = React.useState<string>('');
  const [screenIndex, setScreenIndex] = React.useState<number>(0);
  
  const screenComponents: React.JSX.Element[] = [
    <LoginScreen screenSetter={setScreenIndex} messageSetter={setMessage} message={message} />,
    <MainDashboardScreen screenSetter={setScreenIndex} messageSetter={setMessage} message={message} />,
    <UploadAILogScreen screenSetter={setScreenIndex} messageSetter={setMessage} message={message} />,
  ];

  return (
    <div>
    {screenComponents[screenIndex]}
    <WeflectFlow server={server} />
    </div>

    
  );
}

export default App;