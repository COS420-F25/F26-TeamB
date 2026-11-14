
import React from 'react';
import LoginScreen from './LoginScreen';
import MainScreen from './MainScreen';
import UploadScreen from './UploadScreen';

function App(): React.JSX.Element {
  const [message, setMessage] = React.useState<string>('');
  const [screenIndex, setScreenIndex] = React.useState<number>(0);
  
  const screenComponents: React.JSX.Element[] = [
    <LoginScreen screenSetter={setScreenIndex} messageSetter={setMessage} message={message} />,
    <MainScreen screenSetter={setScreenIndex} messageSetter={setMessage} message={message} />,
    <UploadScreen screenSetter={setScreenIndex} messageSetter={setMessage} message={message} />
  ];

  return (
    screenComponents[screenIndex]
  );
}

export default App;