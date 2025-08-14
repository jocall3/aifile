import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleUser, ChatMessage, KnowledgeFile, Conversation } from '../types';
import { googleDriveService } from '../services/googleDriveService';
import { geminiService } from '../services/geminiService';
import { extractTextFromPdf, convertTxtToPdf } from '../utils/pdfUtils';
import { Plus, LogOut, LoaderCircle, Send, Paperclip, Bot, User, Trash2, FileText, BrainCircuit, MessageSquare, Menu, X } from 'lucide-react';

interface ChatInterfaceProps {
  user: GoogleUser;
  signOut: () => void;
}

const LoadingIndicator: React.FC<{ message: string }> = ({ message }) => (
  <div className="absolute inset-0 bg-dark-800 bg-opacity-75 flex flex-col items-center justify-center z-50">
    <LoaderCircle className="w-10 h-10 animate-spin text-accent" />
    <p className="mt-4 text-white text-lg">{message}</p>
  </div>
);

const ChatInterface: React.FC<ChatInterfaceProps> = ({ user, signOut }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const initApp = useCallback(async () => {
    setIsLoading('Initializing application...');
    try {
      await googleDriveService.findOrCreateAppFolder();
      await refreshKnowledgeFiles();
      const fetchedConversations = await googleDriveService.listConversations();
      setConversations(fetchedConversations);
      if (fetchedConversations.length > 0) {
        await setActiveConversation(fetchedConversations[0].id);
      } else {
        await handleNewConversation();
      }
    } catch (error) {
      console.error('Initialization failed:', error);
      alert('Failed to initialize application. Please check console for details.');
    } finally {
      setIsLoading(null);
    }
  }, []);

  useEffect(() => {
    initApp();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const refreshKnowledgeFiles = async () => {
    const files = await googleDriveService.listKnowledgeFiles();
    setKnowledgeFiles(files);
  };
  
  const refreshConversations = async () => {
    const convos = await googleDriveService.listConversations();
    setConversations(convos);
  }

  const setActiveConversation = async (conversationId: string) => {
    if (!conversationId) return;
    setIsLoading('Loading conversation...');
    setActiveConversationId(conversationId);
    try {
      const content = await googleDriveService.getConversationContent(conversationId);
      const parsedMessages: ChatMessage[] = content.split('---MSG_SEPARATOR---').filter(Boolean).map(msgBlock => {
        const roleMatch = msgBlock.match(/ROLE:(user|model)/);
        const textMatch = msgBlock.match(/TEXT:(.*)/s);
        if (roleMatch && textMatch) {
            return {
                id: Math.random().toString(36).substring(2),
                role: roleMatch[1] as 'user' | 'model',
                text: textMatch[1].trim()
            };
        }
        return null;
      }).filter((m): m is ChatMessage => m !== null);
      setMessages(parsedMessages);
    } catch (error) {
      console.error('Failed to load conversation:', error);
      setMessages([]);
    } finally {
      setIsLoading(null);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeConversationId) return;

    const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading('AI is thinking...');

    try {
      // 1. Assemble Knowledge Base Context
      setIsLoading('Reading knowledge base...');
      const kbTexts = await Promise.all(
        knowledgeFiles.map(async (file) => {
          try {
            const fileContent = await googleDriveService.getFileContent(file.id);
            const text = await extractTextFromPdf(fileContent);
            return `--- START: ${file.name} ---\n${text}\n--- END: ${file.name} ---`;
          } catch(e) {
            console.error(`Could not read ${file.name}`, e);
            return "";
          }
        })
      );
      const knowledgeContext = kbTexts.join('\n\n');

      // 2. Assemble Chat History Context
      const chatHistoryText = messages.map(msg => `${msg.role}: ${msg.text}`).join('\n');
      
      // 3. Generate Response
      setIsLoading('AI is thinking...');
      const aiResponseText = await geminiService.generateResponse(knowledgeContext, chatHistoryText, input);
      const aiMessage: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: aiResponseText };
      setMessages(prev => [...prev, aiMessage]);

      // 4. Update conversation log on Drive
      setIsLoading('Saving conversation...');
      const newHistory = [...messages, userMessage, aiMessage];
      const newLogContent = newHistory.map(msg => `ROLE:${msg.role}\nTEXT:${msg.text}`).join('\n---MSG_SEPARATOR---\n');
      
      await googleDriveService.updateConversationContent(activeConversationId, newLogContent);
      const convos = await googleDriveService.listConversations();
      setConversations(convos);

    } catch (error) {
      console.error('Error during message handling:', error);
      const errorMessage: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: "Sorry, I encountered an error. Please try again." };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(null);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(`Uploading ${file.name}...`);
    try {
      let fileToUpload: { name: string; content: Blob; mimeType: string };

      if (file.type === 'text/plain') {
        const pdfBlob = await convertTxtToPdf(file);
        fileToUpload = { name: `${file.name.replace(/\.txt$/, '')}.pdf`, content: pdfBlob, mimeType: 'application/pdf' };
      } else if (file.type === 'application/pdf') {
        fileToUpload = { name: file.name, content: file, mimeType: 'application/pdf' };
      } else {
        alert('Unsupported file type. Please upload PDF or TXT files.');
        setIsLoading(null);
        return;
      }

      await googleDriveService.uploadKnowledgeFile(fileToUpload.name, fileToUpload.content);
      await refreshKnowledgeFiles();
    } catch (error) {
      console.error('File upload failed:', error);
      alert('File upload failed. See console for details.');
    } finally {
      setIsLoading(null);
      if(fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  
  const handleDeleteKnowledgeFile = async (fileId: string, fileName: string) => {
    if(!window.confirm(`Are you sure you want to delete ${fileName} from your knowledge base?`)) return;
    setIsLoading(`Deleting ${fileName}...`);
    try {
      await googleDriveService.deleteFile(fileId);
      await refreshKnowledgeFiles();
    } catch(e) {
      console.error("Failed to delete file", e);
      alert("Failed to delete file.");
    } finally {
      setIsLoading(null);
    }
  }

  const handleNewConversation = async () => {
    setIsLoading('Creating new conversation...');
    try {
      const newConversation = await googleDriveService.createConversation();
      const convos = await googleDriveService.listConversations();
      setConversations(convos);
      await setActiveConversation(newConversation.id);
    } catch (e) {
      console.error("Failed to create conversation", e);
      alert("Failed to create new conversation.");
    } finally {
        setIsLoading(null);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    if(!window.confirm("Are you sure you want to delete this conversation? This action cannot be undone.")) return;
    setIsLoading("Deleting conversation...");
    try {
        await googleDriveService.deleteFile(conversationId);
        const updatedConversations = await googleDriveService.listConversations();
        setConversations(updatedConversations);
        if (activeConversationId === conversationId) {
            if (updatedConversations.length > 0) {
                await setActiveConversation(updatedConversations[0].id);
            } else {
                await handleNewConversation();
            }
        }
    } catch (error) {
        console.error("Failed to delete conversation", error);
        alert("Could not delete the conversation.");
    } finally {
        setIsLoading(null);
    }
};


  return (
    <div className="flex h-screen bg-light dark:bg-dark-900 text-gray-800 dark:text-gray-200">
      {isLoading && <LoadingIndicator message={isLoading} />}
      
      <aside className={`absolute md:relative z-20 md:z-auto h-full bg-white dark:bg-dark-800 border-r border-gray-200 dark:border-dark-700 transition-transform transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 w-80 flex flex-col`}>
        <div className="p-4 flex justify-between items-center border-b border-gray-200 dark:border-dark-700">
            <h1 className="text-xl font-bold text-primary dark:text-accent flex items-center"><BrainCircuit className="mr-2"/> Knowledge Drive</h1>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1">
                <X className="w-6 h-6"/>
            </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 flex justify-between items-center">
            <h2 className="font-semibold flex items-center"><MessageSquare className="mr-2 h-5 w-5"/> Conversations</h2>
            <button onClick={handleNewConversation} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-dark-600"><Plus className="w-5 h-5"/></button>
          </div>
          <ul className="px-2">
            {conversations.sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()).map(convo => (
              <li key={convo.id} 
                  onClick={() => setActiveConversation(convo.id)}
                  className={`flex justify-between items-center p-2 my-1 rounded-md cursor-pointer truncate ${activeConversationId === convo.id ? 'bg-blue-100 dark:bg-primary text-primary dark:text-white' : 'hover:bg-gray-100 dark:hover:bg-dark-700'}`}>
                <span className="flex-1 truncate">{convo.name}</span>
                <button onClick={(e) => handleDeleteConversation(e, convo.id)} className="ml-2 p-1 rounded-full hover:bg-red-200 dark:hover:bg-red-800 opacity-50 hover:opacity-100">
                  <Trash2 className="w-4 h-4 text-red-500"/>
                </button>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="flex-1 border-t border-gray-200 dark:border-dark-700 overflow-y-auto">
           <div className="p-4 flex justify-between items-center">
            <h2 className="font-semibold flex items-center"><FileText className="mr-2 h-5 w-5"/> Knowledge Base</h2>
            <input id="file-upload" name="file-upload" type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.txt" className="hidden" />
            <label htmlFor="file-upload" className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-dark-600 cursor-pointer" title="Upload file">
              <Paperclip className="w-5 h-5"/>
            </label>
          </div>
          <ul className="px-2">
            {knowledgeFiles.map(file => (
              <li key={file.id} className="flex justify-between items-center p-2 my-1 rounded-md bg-gray-50 dark:bg-dark-700/50">
                <span className="truncate flex-1" title={file.name}>{file.name}</span>
                <button onClick={() => handleDeleteKnowledgeFile(file.id, file.name)} className="ml-2 p-1 rounded-full hover:bg-red-200 dark:hover:bg-red-800 opacity-50 hover:opacity-100">
                  <Trash2 className="w-4 h-4 text-red-500"/>
                </button>
              </li>
            ))}
            {knowledgeFiles.length === 0 && <p className="px-4 text-sm text-gray-500">Upload PDFs or TXT files to add to the knowledge base.</p>}
          </ul>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-dark-700 flex items-center justify-between">
            <div className="flex items-center">
                <img src={user.picture} alt="User" className="w-10 h-10 rounded-full" />
                <div className="ml-3">
                    <p className="font-semibold truncate">{user.name}</p>
                    <p className="text-sm text-gray-500 truncate">{user.email}</p>
                </div>
            </div>
            <button onClick={signOut} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-dark-600" title="Sign Out">
                <LogOut className="w-5 h-5"/>
            </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="p-4 border-b border-gray-200 dark:border-dark-700 flex items-center">
           <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-1 mr-4">
              <Menu className="w-6 h-6"/>
           </button>
           <h2 className="text-lg font-semibold">{conversations.find(c => c.id === activeConversationId)?.name || 'Chat'}</h2>
        </header>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((message) => (
            <div key={message.id} className={`flex items-start gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}>
                {message.role === 'model' && <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white flex-shrink-0"><Bot size={20}/></div>}
                <div className={`max-w-xl p-4 rounded-2xl ${message.role === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-100 dark:bg-dark-700 rounded-bl-none'}`}>
                   <p className="whitespace-pre-wrap">{message.text}</p>
                </div>
                {message.role === 'user' && <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0"><User size={20}/></div>}
            </div>
            ))}
            {messages.length === 0 && (
                <div className="text-center text-gray-500 pt-20">
                    <MessageSquare size={48} className="mx-auto mb-4"/>
                    <p>Start a conversation or ask a question about your knowledge base.</p>
                </div>
            )}
            <div ref={chatEndRef} />
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-dark-700">
            <form onSubmit={handleSendMessage} className="flex items-center space-x-4">
                <label htmlFor="chat-input" className="sr-only">Ask anything...</label>
                <input
                    id="chat-input"
                    name="chat-input"
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask anything..."
                    className="flex-1 p-3 bg-gray-100 dark:bg-dark-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={!!isLoading}
                />
                <button type="submit" className="p-3 bg-primary text-white rounded-lg hover:bg-secondary disabled:bg-gray-400 disabled:cursor-not-allowed" disabled={!input.trim() || !!isLoading}>
                    <Send className="w-6 h-6"/>
                </button>
            </form>
        </div>
      </main>
    </div>
  );
};

export default ChatInterface;