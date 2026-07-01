import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Key, Volume2, Cpu, RefreshCw, Check, AlertCircle } from 'lucide-react';

export default function Settings({
  apiKey = '',
  onSaveApiKey = () => {},
  voiceEnabled = true,
  setVoiceEnabled = () => {},
  wakeWordEnabled = true,
  setWakeWordEnabled = () => {},
  selectedVoice = '',
  setSelectedVoice = () => {},
  speechRate = 1.0,
  setSpeechRate = () => {},
  serverOnline = false
}) {
  const [tempKey, setTempKey] = useState(apiKey);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);

  useEffect(() => {
    setTempKey(apiKey);
  }, [apiKey]);

  useEffect(() => {
    // Load local speech synthesis voices
    const loadVoices = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
      }
    };
    
    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const handleSaveKey = (e) => {
    e.preventDefault();
    onSaveApiKey(tempKey);
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

        {/* API Key Form */}
        <form onSubmit={handleSaveKey} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
            <Key size={14} color="var(--accent-purple)" />
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>GEMINI COGNITION KEY</span>
          </div>
          
          <input
            type="password"
            placeholder="AI Studio API Key"
            value={tempKey}
            onChange={(e) => setTempKey(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', flex: 1 }}
          />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              Gets saved to local session & .env
            </span>
            <button type="submit" className="btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {saveSuccess ? (
                <>
                  <Check size={12} />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Key</span>
              )}
            </button>
          </div>
        </form>

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
                {availableVoices.map((v, i) => (
                  <option key={i} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
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

        {/* Documentation / Info Card */}
        <div style={{ display: 'flex', gap: '0.4rem', padding: '0.5rem', borderRadius: '6px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            To avoid entering your API key in the UI every session, set <strong>GEMINI_API_KEY</strong> inside `backend/.env` and restart the backend.
          </div>
        </div>

      </div>
    </div>
  );
}
