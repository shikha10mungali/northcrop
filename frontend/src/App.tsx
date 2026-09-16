import { ChatWindow } from "./components/ChatWindow";
import "./App.css";

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Conversational Data Analyst</h1>
        <p>Ask natural-language questions about banking customers, accounts, and transactions.</p>
      </header>
      <ChatWindow />
    </div>
  );
}

export default App;
