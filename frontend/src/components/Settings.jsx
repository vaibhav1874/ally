import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Key, Volume2, Cpu, RefreshCw, Check, AlertCircle } from 'lucide-react';
import SystemStats from './SystemStats';

export const isFemaleVoice = (voice) => {
  const name = voice.name.toLowerCase();
  const femaleKeywords = [
    'zira', 'samantha', 'hazel', 'female', 'karen', 'elena', 
    'veena', 'moira', 'fiona', 'tessa', 'victoria', 'google us english', 
    'google uk english female', 'salli', 'joanna', 'ivy', 'kendra', 
    'kimberly', 'amy', 'emma'
  ];
  return femaleKeywords.some(keyword => name.includes(keyword)) && voice.lang.toLowerCase().startsWith('en');
};

export const isIndianVoice = (voice) => {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  return lang.startsWith('en-in') || name.includes('india') || name.includes('indian') || name.includes('heera') || name.includes('ravi') || name.includes('veena') || name.includes('priya');
};

export default function Settings({
  ollamaHost = 'http://localhost:11434',
  ollamaModel = 'llama3.1',
  ollamaVisionModel = 'llava',
  onSaveOllamaSettings = () => {},
  voiceEnabled = true,
  setVoiceEnabled = () => {},
  wakeWordEnabled = true,
  setWakeWordEnabled = () => {},
  selectedVoice = '',
  setSelectedVoice = () => {},
  speechRate = 1.0,
  setSpeechRate = () => {},
  serverOnline = false,
  provider = 'ollama',
  setProvider = () => {},
  geminiApiKey = '',
  setGeminiApiKey = () => {}
}) {
  const [tempHost, setTempHost] = useState(ollamaHost);
  const [tempModel, setTempModel] = useState(ollamaModel);
  const [tempVisionModel, setTempVisionModel] = useState(ollamaVisionModel);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);

  useEffect(() => {
    setTempHost(ollamaHost);
    setTempModel(ollamaModel);
    setTempVisionModel(ollamaVisionModel);
  }, [ollamaHost, ollamaModel, ollamaVisionModel]);

  useEffect(() => {
    // Load local speech synthesis voices
    const loadVoices = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);

        // Auto-select an Indian voice if nothing is selected or if we haven't forced it once yet
        const hasForcedIndian = localStorage.getItem('ally_voice_setup_indian') === 'true';
        
        if (!selectedVoice || !hasForcedIndian) {
          const indianMatch = voices.find(isIndianVoice);
          if (indianMatch) {
            setSelectedVoice(indianMatch.name);
            localStorage.setItem('ally_voice', indianMatch.name);
            localStorage.setItem('ally_voice_setup_indian', 'true');
          } else {
            const femaleMatch = voices.find(isFemaleVoice);
            if (femaleMatch) {
              setSelectedVoice(femaleMatch.name);
              localStorage.setItem('ally_voice', femaleMatch.name);
              localStorage.setItem('ally_voice_setup_indian', 'true');
            }
          }
        }
      }
    };
    
    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedVoice, setSelectedVoice]);

  const handleSaveSettings = (e) => {
    e.preventDefault();
    onSaveOllamaSettings(tempHost, tempModel, tempVisionModel);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="glass-panel" style={{ padding: '1rem', height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <SettingsIcon size={18} color="var(--text-secondary)" />
        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Ally Control Center</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', maxHeight: '420px', paddingRight: '0.25rem' }}>
        
        {/* Status Indicator */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.6rem 0.8rem',
          borderRadius: '8px',
          backgroundColor: serverOnline ? 'rgba(16, 185, 129, 0.05)' : 'rgba(244, 63, 94, 0.05)',
          border: serverOnline ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(244, 63, 94, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
            <Cpu size={15} color={serverOnline ? 'var(--accent-emerald)' : 'var(--accent-rose)'} />
            <span>Core Server Connection:</span>
          </div>
          <span style={{
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 'bold',
            color: serverOnline ? 'var(--accent-emerald)' : 'var(--accent-rose)'
          }}>
            {serverOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        {/* Provider Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }} className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem', marginBottom: '0.2rem' }}>
            <Cpu size={14} color="var(--accent-purple)" />
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>AI PROVIDER CONFIGURATION</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
            <button
              type="button"
              onClick={() => setProvider('ollama')}
              style={{
                flex: 1,
                padding: '0.5rem',
                fontSize: '0.75rem',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: provider === 'ollama' ? 'var(--accent-purple)' : 'var(--border-color)',
                background: provider === 'ollama' ? 'rgba(157, 78, 221, 0.1)' : 'transparent',
                color: provider === 'ollama' ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Ollama (Local CPU/GPU)
            </button>
            <button
              type="button"
              onClick={() => setProvider('gemini')}
              style={{
                flex: 1,
                padding: '0.5rem',
                fontSize: '0.75rem',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: provider === 'gemini' ? 'var(--accent-purple)' : 'var(--border-color)',
                background: provider === 'gemini' ? 'rgba(157, 78, 221, 0.1)' : 'transparent',
                color: provider === 'gemini' ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Gemini (Cloud - Fast & Free)
            </button>
          </div>
        </div>

        {/* Ollama Settings Form */}
        {provider === 'ollama' && (
          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }} className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
              <Key size={14} color="var(--accent-purple)" />
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>LOCAL OLLAMA ENGINE</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ollama Host URL:</span>
                <input
                  type="text"
                  placeholder="http://localhost:11434"
                  value={tempHost}
                  onChange={(e) => setTempHost(e.target.value)}
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Chat Model (Tools Supported):</span>
                <input
                  type="text"
                  placeholder="llama3.1"
                  value={tempModel}
                  onChange={(e) => setTempModel(e.target.value)}
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Vision Model (Multimodal):</span>
                <input
                  type="text"
                  placeholder="llava"
                  value={tempVisionModel}
                  onChange={(e) => setTempVisionModel(e.target.value)}
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                Configure models in `.env` too
              </span>
              <button type="submit" className="btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {saveSuccess ? (
                  <>
                    <Check size={12} />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save Configurations</span>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Gemini Settings Form */}
        {provider === 'gemini' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }} className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
              <Key size={14} color="var(--accent-blue)" />
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>GEMINI API ENGINE</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Gemini API Key:</span>
                <input
                  type="password"
                  placeholder="Paste your Gemini API key here..."
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', background: '#12121f', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px' }}
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.4rem', padding: '0.5rem', borderRadius: '6px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              <div>
                Get a free API key at <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'underline', fontWeight: 'bold' }}>Google AI Studio</a>. Flash models are completely free and provide ultra-fast speeds!
              </div>
            </div>
          </div>
        )}

        {/* Voice preferences */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem', marginBottom: '0.2rem' }}>
            <Volume2 size={14} color="var(--accent-blue)" />
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>VOICE & SPEECH CONTROLS</span>
          </div>

          {/* Toggle TTS */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
            <span>Voice Response (Speak Out Load):</span>
            <input
              type="checkbox"
              checked={voiceEnabled}
              onChange={(e) => setVoiceEnabled(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
          </div>

          {/* Wake word toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
            <span>Continuous "Hey Ally" Wake Listening:</span>
            <input
              type="checkbox"
              checked={wakeWordEnabled}
              onChange={(e) => setWakeWordEnabled(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
          </div>

          {/* Voice Selector */}
          {voiceEnabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.2rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Select Companion Voice:</span>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                style={{ padding: '0.4rem', fontSize: '0.75rem', background: '#12121f', width: '100%' }}
              >
                <option value="">Default System Voice</option>
                {availableVoices.map((v, i) => {
                  const isFemale = isFemaleVoice(v);
                  const isIndian = isIndianVoice(v);
                  let suffix = '';
                  if (isIndian) suffix = ' 🇮🇳 (Indian Accent)';
                  else if (isFemale) suffix = ' ♀ (Female)';
                  return (
                    <option key={i} value={v.name}>
                      {v.name} ({v.lang}){suffix}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Speech Rate slider */}
          {voiceEnabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Speech Rate:</span>
                <span>{speechRate}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={speechRate}
                onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                style={{ padding: 0, height: '4px', cursor: 'pointer', accentColor: 'var(--accent-blue)' }}
              />
            </div>
          )}
        </div>

        {/* Hardware Status Monitor */}
        <SystemStats serverOnline={serverOnline} />

        {/* Documentation / Info Card */}
        <div style={{ display: 'flex', gap: '0.4rem', padding: '0.5rem', borderRadius: '6px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            Ensure your local Ollama instance is active. Run <strong>ollama run llama3.1</strong> in a shell to download the base chat model.
          </div>
        </div>

      </div>
    </div>
  );
}
