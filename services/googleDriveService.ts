// Copyright James Burvel O’Callaghan III
// President Citibank Demo Business Inc.

import { KnowledgeFile, Conversation } from '../types';

const APP_FOLDER_NAME = 'Gemini_Knowledge_Drive_App';
let appFolderId: string | null = null;

const findOrCreateAppFolder = async (): Promise<string> => {
  if (appFolderId) return appFolderId;

  try {
    const response = await gapi.client.drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${APP_FOLDER_NAME}' and trashed=false`,
      fields: 'files(id, name)',
    });
    
    if (response.result.files && response.result.files.length > 0) {
      appFolderId = response.result.files[0].id!;
      return appFolderId;
    } else {
      const fileMetadata = {
        name: APP_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      };
      const newFolderResponse = await gapi.client.drive.files.create({
        resource: fileMetadata,
        fields: 'id',
      });
      appFolderId = newFolderResponse.result.id!;
      return appFolderId;
    }
  } catch (error) {
    console.error("Error finding or creating app folder:", error);
    throw new Error("Could not access or create the application folder in Google Drive.");
  }
};

const listFilesByQuery = async (query: string) => {
    const folderId = await findOrCreateAppFolder();
    const fullQuery = `'${folderId}' in parents and (${query}) and trashed=false`;
    const response = await gapi.client.drive.files.list({
        q: fullQuery,
        fields: 'files(id, name, mimeType, modifiedTime)',
        orderBy: 'modifiedTime desc',
    });
    return response.result.files || [];
}

const listKnowledgeFiles = async (): Promise<KnowledgeFile[]> => {
    const files = await listFilesByQuery("name != 'conversation.log' and not name contains 'conversation-'");
    return files.map(file => ({
        id: file.id!,
        name: file.name!,
        mimeType: file.mimeType!,
    }));
};

const listConversations = async (): Promise<Conversation[]> => {
    const files = await listFilesByQuery("name contains 'conversation-' and mimeType = 'text/plain'");
    return files.map(file => ({
        id: file.id!,
        name: file.name!.replace('conversation-', '').replace('.log', ''),
        modifiedTime: file.modifiedTime!
    }));
}

const createConversation = async (): Promise<Conversation> => {
    const folderId = await findOrCreateAppFolder();
    const convoName = `conversation-${new Date().toISOString()}.log`;
    const fileMetadata = {
        name: convoName,
        mimeType: 'text/plain',
        parents: [folderId],
    };

    const response = await gapi.client.drive.files.create({
        resource: fileMetadata,
        fields: 'id, name, modifiedTime',
    });

    return {
        id: response.result.id!,
        name: response.result.name!.replace('conversation-', '').replace('.log', ''),
        modifiedTime: response.result.modifiedTime!,
    };
};

const uploadKnowledgeFile = async (name: string, content: Blob): Promise<void> => {
  const folderId = await findOrCreateAppFolder();
  const metadata = {
    name,
    parents: [folderId],
    mimeType: content.type
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', content);

  const token = gapi.client.getToken();
  if (!token) {
    throw new Error("User not authenticated. Cannot upload file.");
  }

  await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: new Headers({ 'Authorization': `Bearer ${token.access_token}` }),
    body: form,
  });
};

const getFileContent = async (fileId: string): Promise<ArrayBuffer> => {
    const response = await gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media'
    });
    return response.body.length > 0 ? new TextEncoder().encode(response.body).buffer : new ArrayBuffer(0);
};

const getConversationContent = async(conversationId: string): Promise<string> => {
    const response = await gapi.client.drive.files.get({
        fileId: conversationId,
        alt: 'media'
    });
    return response.body;
};

const updateConversationContent = async (conversationId: string, content: string): Promise<void> => {
    const token = gapi.client.getToken();
    if (!token) {
        throw new Error("User not authenticated. Cannot update conversation.");
    }
    const blob = new Blob([content], {type: 'text/plain'});
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${conversationId}?uploadType=media`, {
        method: 'PATCH',
        headers: new Headers({ 
            'Authorization': `Bearer ${token.access_token}`,
            'Content-Type': 'text/plain'
        }),
        body: blob
    });
};

const deleteFile = async (fileId: string): Promise<void> => {
    await gapi.client.drive.files.delete({ fileId });
}

export const googleDriveService = {
  findOrCreateAppFolder,
  listKnowledgeFiles,
  uploadKnowledgeFile,
  getFileContent,
  deleteFile,
  listConversations,
  createConversation,
  getConversationContent,
  updateConversationContent
};