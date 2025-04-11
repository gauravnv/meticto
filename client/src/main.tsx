import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { SocketProvider } from './context/SocketContext';
import { Toaster } from 'react-hot-toast';
import { SettingsProvider } from './context/SettingsContext.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode>
  <SettingsProvider>
    <SocketProvider>
      <Toaster // Add the Toaster component here
        position="top-center" // Optional: Configure position
        reverseOrder={false} // Optional: Configure order
        toastOptions={{ // Optional: Configure default options
          // Define default options
          // className: '',
          duration: 5000, // Default duration in ms
          style: {
            background: '#333', // Dark background
            color: '#fff', // White text
          },
          // Default options for specific types
          success: {
            duration: 3000,
            // theme: {
            //   primary: 'green',
            //   secondary: 'black',
            // },
          },
           error: {
              duration: 6000, // Longer duration for errors
          },
        }}
      />
      <App />
    </SocketProvider>
    </SettingsProvider>
  // </React.StrictMode>,
);