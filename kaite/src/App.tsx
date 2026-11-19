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
    </div>
  );
}

export default App;