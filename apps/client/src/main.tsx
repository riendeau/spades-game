import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { MobilePreview } from './components/dev/MobilePreview';
import { preloadCardImages } from './components/ui/Card';
import { SocketProvider } from './socket/socket-context';

preloadCardImages();

const isMobilePreview = new URLSearchParams(window.location.search).has(
  'mobile'
);

// Global styles
const style = document.createElement('style');
style.textContent = `
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  button {
    font-family: inherit;
  }

  input {
    font-family: inherit;
  }

  input:focus {
    border-color: #3b82f6;
  }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isMobilePreview ? (
      <MobilePreview />
    ) : (
      <SocketProvider>
        <App />
      </SocketProvider>
    )}
  </React.StrictMode>
);
