import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Sermo</h1>
      </header>
      <main>
        <div className="chat-window">
          <div className="message-list">
            {/* Messages will be displayed here */}
          </div>
          <div className="message-input">
            <input type="text" placeholder="Type your message..." />
            <button>Send</button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
