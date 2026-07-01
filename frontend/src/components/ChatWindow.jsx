import React, { useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Image, Trash2, Copy, Check } from 'lucide-react';

export default function ChatWindow({
  messages = [],
  inputValue = '',
  setInputValue = () => {},
  onSendMessage = () => {},
  isListening = false,
  toggleListening = () => {},
  useVision = false,
  setUseVision = () => {},
  onClearHistory = () => {},
  isLoading = false
}) {
  const chatEndRef = useRef(null);
  const [copiedIndex, setCopiedIndex] = React.useState(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Helper to render message content with basic formatting and code blocks
  const renderMessageContent = (text, msgIndex) => {
    // Regular expression to check for code blocks
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push(
          <p key={`text-${lastIndex}`} style={{ whiteSpace: 'pre-wrap', marginBottom: '0.75rem' }}>
            {text.substring(lastIndex, match.index)}
          </p>
        );
      }

      const language = match[1] || 'code';
      const codeContent = match[2];
      const currentIndex = match.index;

      parts.push(
        <div key={`code-${currentIndex}`} className="code-block-container" style={{ margin: '1rem 0', position: 'relative' }}>
          <div style={{
            background: '#12121f',
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px',
            padding: '0.4rem 1rem',
            border: '1px solid var(--border-color)',
            borderBottom: 'none',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)'
          }}>
            <span>{language.toUpperCase()}</span>
            <button
              onClick={() => copyToClipboard(codeContent, currentIndex)}
              style={{
                background: 'transparent',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.7rem'
              }}
              title="Copy Code"
            >
              {copiedIndex === currentIndex ? (
                <>
                  <Check size={12} color="var(--accent-emerald)" />
                  <span style={{ color: 'var(--accent-emerald)' }}>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <pre style={{
            margin: 0,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0
          }}>
            <code>{codeContent}</code>
          </pre>
        </div>
      );

      lastIndex = codeBlockRegex.lastIndex;
    }

    // Add trailing text
    if (lastIndex < text.length) {
      parts.push(
        <p key={`text-${lastIndex}`} style={{ whiteSpace: 'pre-wrap' }}>
          {text.substring(lastIndex)}
        </p>
      );
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '480px', overflow: 'hidden' }}>
      
      {/* Header bar */}
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isLoading ? 'var(--accent-purple)' : 'var(--accent-emerald)' }}></div>
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Companion Console</span>
        </div>
        <button
          onClick={onClearHistory}
          style={{
            background: 'transparent',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.25rem 0.5rem'
          }}
          className="btn-secondary"
          title="Clear Chat Log"
        >
          <Trash2 size={14} />
          <span style={{ fontSize: '0.75rem' }}>Clear</span>
        </button>
      </div>

      {/* Message Feed */}
      <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
            <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Welcome to Ally companion dashboard.</p>
            <p style={{ fontSize: '0.8rem' }}>Say <strong>"Hey Ally"</strong> or type a message below to begin.</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
              }}
            >
              <div style={{
                fontSize: '0.7rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start'
              }}>
                {msg.role === 'user' ? 'YOU' : 'ALLY'}
              </div>
              <div style={{
                background: msg.role === 'user' ? 'var(--accent-purple-glow)' : 'rgba(255,255,255,0.03)',
                border: '1px solid',
                borderColor: msg.role === 'user' ? 'rgba(157, 78, 221, 0.25)' : 'var(--border-color)',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                borderTopRightRadius: msg.role === 'user' ? '2px' : '12px',
                borderTopLeftRadius: msg.role === 'user' ? '12px' : '2px',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                lineHeight: '1.5'
              }}>
                {renderMessageContent(msg.content, i)}
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>ALLY</span>
            <div style={{ display: 'flex', gap: '4px', padding: '0.75rem 1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--text-muted)', animation: 'float 1.2s infinite ease-in-out' }}></div>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--text-muted)', animation: 'float 1.2s infinite ease-in-out 0.2s' }}></div>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--text-muted)', animation: 'float 1.2s infinite ease-in-out 0.4s' }}></div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Tray */}
      <form onSubmit={handleSubmit} style={{
        padding: '1rem',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        background: 'rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          
          {/* Use Vision Option */}
          <button
            type="button"
            onClick={() => setUseVision(!useVision)}
            style={{
              padding: '0.6rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: useVision ? 'var(--accent-blue-glow)' : 'transparent',
              borderColor: useVision ? 'var(--accent-blue)' : 'var(--border-color)',
              borderWidth: '1px',
              borderStyle: 'solid',
              color: useVision ? 'var(--accent-blue)' : 'var(--text-muted)'
            }}
            title="Attach Active Screen Monitor Content"
          >
            <Image size={18} />
          </button>
          
          {/* Micro Voice Active Trigger */}
          <button
            type="button"
            onClick={toggleListening}
            style={{
              padding: '0.6rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isListening ? 'var(--accent-emerald-glow)' : 'transparent',
              borderColor: isListening ? 'var(--accent-emerald)' : 'var(--border-color)',
              borderWidth: '1px',
              borderStyle: 'solid',
              color: isListening ? 'var(--accent-emerald)' : 'var(--text-muted)'
            }}
            title={isListening ? 'Stop Voice Listening' : 'Start Voice Listening ("Hey Ally" Wake Enabled)'}
          >
            {isListening ? <Mic size={18} /> : <MicOff size={18} />}
          </button>

          {/* Core Prompt Input */}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isListening ? "Listening for 'Hey Ally' or speech..." : "Message Ally companion..."}
            style={{ flex: 1 }}
            disabled={isLoading}
          />

          <button
            type="submit"
            className="btn-primary"
            style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            disabled={isLoading || !inputValue.trim()}
          >
            <Send size={16} />
            <span style={{ display: 'none' }}>Send</span>
          </button>
        </div>
        
        {useVision && (
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--accent-blue)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontFamily: 'var(--font-mono)'
          }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-blue)' }}></span>
            Vision context active: Next prompt will capture and analyze your computer screen.
          </div>
        )}
      </form>
    </div>
  );
}
