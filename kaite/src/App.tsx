
import React from 'react';
import LoginScreen from './LoginScreen';
import MainDashboardScreen from './MainDashboardScreen';
import UploadAILogScreen from './UploadAILogScreen';

function App(): React.JSX.Element {
  const [message, setMessage] = React.useState<string>('');
  const [screenIndex, setScreenIndex] = React.useState<number>(0);
  
  const screenComponents: React.JSX.Element[] = [
    <LoginScreen screenSetter={setScreenIndex} messageSetter={setMessage} message={message} />,
    <MainDashboardScreen screenSetter={setScreenIndex} messageSetter={setMessage} message={message} />,
    <UploadAILogScreen screenSetter={setScreenIndex} messageSetter={setMessage} message={message} />
  ];

  return (
    screenComponents[screenIndex]
  );
}

export default App;