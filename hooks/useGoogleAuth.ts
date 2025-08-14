import { useState, useEffect } from 'react';
import { GoogleUser } from '../types';

export const useGoogleAuth = (clientId: string | undefined, apiKey: string | undefined) => {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [tokenClient, setTokenClient] = useState<google.accounts.oauth2.TokenClient | null>(null);
  const [isGapiReady, setIsGapiReady] = useState(false);

  useEffect(() => {
    if(!clientId || !apiKey){
        console.error("Google Client ID or API Key is missing.");
        alert("Configuration error: Google Client ID or API Key is not configured.");
        return;
    }

    const gapiScriptId = 'gapi-script';
    const gsiScriptId = 'gsi-script';
    
    // Cleanup function to remove scripts
    const cleanup = () => {
        const gapiScriptEl = document.getElementById(gapiScriptId);
        if (gapiScriptEl) gapiScriptEl.remove();
        
        const gsiScriptEl = document.getElementById(gsiScriptId);
        if (gsiScriptEl) gsiScriptEl.remove();
    };

    const initializeGsi = () => {
        if (window.google?.accounts?.oauth2 && clientId) {
            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: 'https://www.googleapis.com/auth/drive.file',
                callback: async (tokenResponse) => {
                    if (tokenResponse.error) {
                        console.error('Token Error:', tokenResponse.error);
                        return;
                    }
                    gapi.client.setToken(tokenResponse);
                    
                    try {
                        const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                            headers: { 'Authorization': `Bearer ${tokenResponse.access_token}` }
                        });
                        const profile = await profileResponse.json();
                        setUser({ name: profile.name, email: profile.email, picture: profile.picture });
                    } catch (error) {
                        console.error("Failed to fetch user profile", error);
                    }
                },
            });
            setTokenClient(client);
            setIsGapiReady(true);
        } else {
            console.error("Google Identity Services not loaded or client_id missing.");
            alert("Failed to load Google Sign-In services. Please check your network connection and try again.");
        }
    };

    const initializeGapiClient = async () => {
        try {
            await gapi.client.init({
                apiKey: apiKey,
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            });
            // After GAPI is initialized, load GSI
            const gsiScript = document.createElement('script');
            gsiScript.id = gsiScriptId;
            gsiScript.src = 'https://accounts.google.com/gsi/client';
            gsiScript.async = true;
            gsiScript.defer = true;
            gsiScript.onload = initializeGsi;
            gsiScript.onerror = () => {
                console.error("Failed to load GSI script.");
                alert("Failed to load Google Sign-In services. Please check your network connection and try again.");
            };
            document.body.appendChild(gsiScript);
        } catch (error) {
            console.error("Error initializing GAPI client:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes("API discovery response missing required fields")) {
                alert("Failed to initialize Google Drive API. This can sometimes be a temporary issue. Please try refreshing the page.");
            } else {
                alert(`An error occurred while initializing Google services: ${errorMessage}`);
            }
        }
    };
    
    const loadGapiClient = () => {
        gapi.load('client', initializeGapiClient);
    };

    // Load the GAPI script first
    const gapiScript = document.createElement('script');
    gapiScript.id = gapiScriptId;
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.async = true;
    gapiScript.defer = true;
    gapiScript.onload = loadGapiClient;
    gapiScript.onerror = () => {
        console.error("Failed to load GAPI script.");
        alert("Failed to load Google API services. Please check your network connection and try again.");
    };
    document.body.appendChild(gapiScript);

    return cleanup;
  }, [clientId, apiKey]);

  const signIn = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken();
    }
  };

  const signOut = () => {
    const token = gapi.client.getToken();
    if (token && window.google?.accounts?.oauth2) {
      google.accounts.oauth2.revoke(token.access_token, () => {
        gapi.client.setToken(null);
        setUser(null);
      });
    } else {
        if (gapi?.client) {
            gapi.client.setToken(null);
        }
        setUser(null);
    }
  };

  return { user, tokenClient, isGapiReady, signIn, signOut };
};
