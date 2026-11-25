import React from 'react';
import './App.css';
import './WeFlectComponents/styles/kaite.css';
import LoginScreen from './screens/Login/LoginScreen';
import MainDashboardScreen from './screens/MainDashboard/MainDashboardScreen';
import UploadAILogScreen from './screens/UploadAILog/UploadAILogScreen';
import GoalConfigScreen from './screens/GoalConfig/GoalConfigScreen';

function App(): React.JSX.Element {
  const [message, setMessage] = React.useState<string>('');
  const [screenIndex, setScreenIndex] = React.useState<number>(0);
  
  const screenComponents: React.JSX.Element[] = [
    <LoginScreen screenSetter={setScreenIndex} messageSetter={setMessage} message={message} />,
    <MainDashboardScreen screenSetter={setScreenIndex} messageSetter={setMessage} message={message} />,
    <UploadAILogScreen screenSetter={setScreenIndex} messageSetter={setMessage} message={message} />,
    <GoalConfigScreen screenSetter={setScreenIndex} messageSetter={setMessage} message={message} />
  ];

  return (
    <div>
    {screenComponents[screenIndex]}
    </div>
  );
}

export default App;