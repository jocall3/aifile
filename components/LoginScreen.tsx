import React from 'react';
import { Chrome } from 'lucide-react';

interface LoginScreenProps {
  onSignIn: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onSignIn }) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-light to-blue-100 dark:from-dark-900 dark:to-dark-800">
      <div className="text-center p-8 bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-md mx-4">
        <h1 className="text-4xl md:text-5xl font-bold text-primary dark:text-accent mb-2">
          Gemini Knowledge Drive
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-8 text-lg">
          Your personal AI assistant, powered by your Google Drive.
        </p>
        <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">
          Sign in to connect your Google Drive account. This app will create a dedicated folder to store your knowledge base and chat history.
        </p>
        <button
          onClick={onSignIn}
          className="flex items-center justify-center w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-transform transform hover:scale-105"
        >
          <Chrome className="w-5 h-5 mr-3" />
          Sign in with Google
        </button>
      </div>
       <p className="mt-8 text-xs text-gray-500 dark:text-gray-400">
          Note: This application requires access to your Google Drive to function.
        </p>
    </div>
  );
};

export default LoginScreen;