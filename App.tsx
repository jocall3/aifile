import React from 'react';
import { useGoogleAuth } from './hooks/useGoogleAuth';
import LoginScreen from './components/LoginScreen';
import ChatInterface from './components/ChatInterface';
import { LoaderCircle } from 'lucide-react';

const GOOGLE_CLIENT_ID = '555179712981-36hlicm802genhfo9iq1ufnp1n8cikt9.apps.googleusercontent.com';
const GOOGLE_API_KEY = process.env.API_KEY; // Use the standard API_KEY from environment

const App: React.FC = () => {
  const { user, tokenClient, isGapiReady, signIn, signOut } = useGoogleAuth(GOOGLE_CLIENT_ID, GOOGLE_API_KEY);

  const renderContent = () => {
    if (!isGapiReady) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-light dark:bg-dark-900 text-gray-800 dark:text-gray-200">
          <LoaderCircle className="w-12 h-12 animate-spin text-primary" />
          <p className="mt-4 text-lg">Initializing Google Services...</p>
        </div>
      );
    }

    if (!user || !tokenClient) {
      return <LoginScreen onSignIn={signIn} />;
    }

    return <ChatInterface user={user} signOut={signOut} />;
  };

  return (
    <div className="min-h-screen font-sans text-gray-800 dark:text-gray-200">
      {renderContent()}
    </div>
  );
};

export default App;