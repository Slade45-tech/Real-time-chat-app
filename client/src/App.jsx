import React from 'react';
import { ChatProvider, useChat } from './context/ChatContext';
import Login from './components/Login';
import Chat from './components/Chat';

const AppContent = () => {
  const { user } = useChat();
  return user ? <Chat /> : <Login />;
};

function App() {
  return (
    <ChatProvider>
      <AppContent />
    </ChatProvider>
  );
}

export default App;
