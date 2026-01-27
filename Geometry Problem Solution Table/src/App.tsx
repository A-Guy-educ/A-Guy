import { useState } from 'react';
import { Send } from 'lucide-react';

interface Message {
  id: number;
  type: 'bot' | 'user';
  content: string | JSX.Element;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: 'user',
      content: 'תוכל לעזור לי לפתור תרגיל בגיאומטריה? נתון משולש ABC שווה שוקיים, והזווית הראש היא 40 מעלות.'
    },
    {
      id: 2,
      type: 'bot',
      content: (
        <div>
          <p>בטח! הנה הפתרון המלא:</p>
          
          <div className="geometry-table">
            <div className="table-header">
              <div className="header-cell">טענה</div>
              <div className="header-cell">נימוק</div>
            </div>
            
            <div className="table-row">
              <div className="table-cell">
                <span className="math-inline">∠BAC = 40°</span>
              </div>
              <div className="table-cell">נתון במשולש</div>
            </div>
            
            <div className="table-row">
              <div className="table-cell">
                <span className="math-inline">AB = AC</span>
              </div>
              <div className="table-cell">משולש שווה שוקיים</div>
            </div>
            
            <div className="table-row">
              <div className="table-cell">
                <span className="math-inline">∠ABC = ∠ACB</span>
              </div>
              <div className="table-cell">זוויות בסיס במשולש שווה שוקיים</div>
            </div>
            
            <div className="table-row">
              <div className="table-cell">
                <span className="math-inline">∠ABC + ∠ACB + ∠BAC = 180°</span>
              </div>
              <div className="table-cell">סכום זוויות במשולש</div>
            </div>
            
            <div className="table-row">
              <div className="table-cell">
                <span className="math-inline">2∠ABC + 40° = 180°</span>
              </div>
              <div className="table-cell">הצבה</div>
            </div>
            
            <div className="table-row">
              <div className="table-cell">
                <span className="math-inline">2∠ABC = 140°</span>
              </div>
              <div className="table-cell">העברת אגפים</div>
            </div>
            
            <div className="table-row">
              <div className="table-cell">
                <span className="math-inline">∠ABC = ∠ACB = 70°</span>
              </div>
              <div className="table-cell">חלוקה ב-2</div>
            </div>
          </div>
          
          <p style={{ marginTop: '16px' }}>זוויות הבסיס הן 70 מעלות כל אחת.</p>
        </div>
      )
    }
  ]);
  
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (!inputValue.trim()) return;
    
    setMessages([...messages, {
      id: messages.length + 1,
      type: 'user',
      content: inputValue
    }]);
    
    setInputValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="app-container">
      <header>
        <div className="brand">
          <h1>
            עוזר מתמטיקה
            <span className="status-dot"></span>
          </h1>
        </div>
      </header>

      <div className="chat-area">
        {messages.map((message) => (
          <div key={message.id} className={`message-row ${message.type}`}>
            <div className={`chat-icon ${message.type}`}>
              {message.type === 'bot' ? (
                <div className="inner"></div>
              ) : (
                <div className="inner"></div>
              )}
            </div>
            <div className="bubble">
              {message.content}
            </div>
          </div>
        ))}
      </div>

      <div className="input-panel">
        <div className="input-wrapper">
          <input
            type="text"
            placeholder="שאל שאלה במתמטיקה..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button className="send-btn" onClick={handleSend}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
