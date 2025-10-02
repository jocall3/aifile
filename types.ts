// Copyright James Burvel O’Callaghan III
// President Citibank Demo Business Inc.

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export interface KnowledgeFile {
  id: string;
  name: string;
  mimeType: string;
}

export interface GoogleUser {
  name: string;
  email: string;
  picture: string;
}

export interface Conversation {
  id: string;
  name: string;
  modifiedTime: string;
}


// ---- Google API Type Declarations ----
// To inform TypeScript about the global `gapi` and `google` objects,
// which are loaded from external scripts.

// Represents a file resource from the Google Drive API
interface GapiFile {
  id?: string;
  name?: string;
  mimeType?: string;
  modifiedTime?: string;
}

// Represents the token response from Google's OAuth2 flow.
interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
}


declare global {
  namespace gapi {
    function load(apiName: string, callback: () => void): void;

    namespace client {
      function init(args: { apiKey: string; discoveryDocs: string[] }): Promise<void>;
      function setToken(token: object | null): void;
      function getToken(): { access_token: string } | null;
      
      namespace drive {
        const files: {
          list(args: {
            q: string;
            fields: string;
            orderBy?: string;
          }): Promise<{ result: { files?: GapiFile[] } }>;
          create(args: {
            resource: object;
            fields: string;
          }): Promise<{ result: { id: string; name: string; modifiedTime: string; } }>;
          get(args: {
            fileId: string;
            alt: 'media';
          }): Promise<{ body: string }>;
          delete(args: { fileId: string }): Promise<void>;
        };
      }
    }
  }

  namespace google {
    namespace accounts {
      namespace oauth2 {
        interface TokenClient {
          requestAccessToken(): void;
        }

        function initTokenClient(config: {
          client_id: string;
          scope: string;
          callback: (tokenResponse: GoogleTokenResponse) => void;
        }): TokenClient;

        function revoke(token: string, callback: () => void): void;
      }
    }
  }
}

// The `export {}` is important to ensure this file is treated as a module,
// which is required for `declare global` to work correctly.
export {};
