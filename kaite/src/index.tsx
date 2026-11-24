import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { FramingScreen } from './FramingChoicesScreen';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

const preview = new URLSearchParams(window.location.search).get('preview');

root.render(
  <React.StrictMode>
    {preview === 'framing' ? (
      <FramingScreen
        onStart={(prefs) => console.log('onStart', prefs)}
        onBack={() => console.log('onBack')}
      />
    ) : (
      <App />
    )}
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
