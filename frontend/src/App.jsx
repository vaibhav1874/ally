import React, { useState, useEffect, useRef } from 'react';
import { voiceService } from './services/VoiceService';
import OrbVisualizer from './components/OrbVisualizer';
import ChatWindow from './components/ChatWindow';
import MemoryHub from './components/MemoryHub';
import AutomationPanel from './components/AutomationPanel';
import Settings from './components/Settings';
import SystemStats from './components/SystemStats';
import { Cpu, Terminal, Brain, Settings as SettingsIcon, Mic, Volume2 } from 'lucide-react';

export default function App() {
  // Navigation tabs for the right sidebar
  const [activeTab, setActiveTab] = useState('automation');

  // UI state
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [companionState, setCompanionState] = useState('idle');
  const [amplitude, setAmplitude] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [useVision, setUseVision] = useState(false);
  const [jarvisMode, setJarvisMode] = useState(localStorage.getItem('ally_jarvis_mode') === 'true');

  // Settings state (loads from localStorage where possible)
  const [ollamaHost, setOllamaHost] = useState(localStorage.getItem('ally_ollama_host') || 'http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState(localStorage.getItem('ally_ollama_model') || 'llama3.1');
  const [ollamaVisionModel, setOllamaVisionModel] = useState(localStorage.getItem('ally_ollama_vision_model') || 'llava');
  const [voiceEnabled, setVoiceEnabled] = useState(localStorage.getItem('ally_voice_enabled') !== 'false');
  const [wakeWordEnabled, setWakeWordEnabled] = useState(localStorage.getItem('ally_wakeword_enabled') !== 'false');
  const [selectedVoice, setSelectedVoice] = useState(localStorage.getItem('ally_voice') || '');
  const [speechRate, setSpeechRate] = useState(parseFloat(localStorage.getItem('ally_speech_rate') || '1.0'));
  const [provider, setProvider] = useState(localStorage.getItem('ally_provider') || 'ollama');
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem('ally_gemini_api_key') || '');

  // Backend state
  const [memories, setMemories] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState({});
  const [serverOnline, setServerOnline] = useState(false);

  // Refs for tracking speaking loops and sync state callbacks safely without effect recycles
  const amplitudeIntervalRef = useRef(null);
  const wakeWordEnabledRef = useRef(wakeWordEnabled);
  const companionStateRef = useRef(companionState);
  const jarvisModeRef = useRef(jarvisMode);
  const handleSendMessageRef = useRef(null);
  const handleVoiceOutputRef = useRef(null);

  useEffect(() => {
    wakeWordEnabledRef.current = wakeWordEnabled;
  }, [wakeWordEnabled]);

  useEffect(() => {
    companionStateRef.current = companionState;
  }, [companionState]);

  useEffect(() => {
    jarvisModeRef.current = jarvisMode;
  }, [jarvisMode]);

  useEffect(() => {
    localStorage.setItem('ally_voice_enabled', voiceEnabled);
  }, [voiceEnabled]);

  useEffect(() => {
    localStorage.setItem('ally_wakeword_enabled', wakeWordEnabled);
  }, [wakeWordEnabled]);

  useEffect(() => {
    localStorage.setItem('ally_voice', selectedVoice);
  }, [selectedVoice]);

  useEffect(() => {
    localStorage.setItem('ally_speech_rate', speechRate);
  }, [speechRate]);

  useEffect(() => {
    localStorage.setItem('ally_provider', provider);
  }, [provider]);

  useEffect(() => {
    localStorage.setItem('ally_gemini_api_key', geminiApiKey);
  }, [geminiApiKey]);

  useEffect(() => {
    localStorage.setItem('ally_jarvis_mode', jarvisMode);
  }, [jarvisMode]);

  // --- Play Web Audio Synth Chime ---
  const playWakeSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gain1.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.12);
      
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.frequency.setValueAtTime(1174.66, audioCtx.currentTime); // D6
        gain2.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);
        osc2.start();
        osc2.stop(audioCtx.currentTime + 0.22);
      }, 70);
    } catch (e) {
      console.warn("Wake chime audio failed: ", e);
    }
  };

  // --- Backend API Sync Functions ---

  const checkServerStatus = async () => {
    try {
      const res = await fetch('/api/');
      if (res.ok) {
        setServerOnline(true);
        return true;
      }
    } catch (e) {
      setServerOnline(false);
    }
    return false;
  };

  const fetchChatHistory = async () => {
    try {
      const res = await fetch('/api/chat/history');
      if (res.ok) {
        const data = await res.json();
        setMessages(data.history || []);
      }
    } catch (e) {
      console.error("Error loading chat history: ", e);
    }
  };

  const fetchMemories = async () => {
    try {
      const res = await fetch('/api/memory');
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories || []);
      }
    } catch (e) {
      console.error("Error loading memories: ", e);
    }
  };

  const fetchPendingTasks = async () => {
    try {
      const res = await fetch('/api/system/pending');
      if (res.ok) {
        const data = await res.json();
        setPendingTasks(data.pending || []);
      }
    } catch (e) {
      console.error("Error loading pending commands: ", e);
    }
  };

  // --- WebSocket Connection ---

  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/ws`;
    let socket;

    const connectWebSocket = () => {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log("WebSocket linked to core server.");
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.event === 'pending_commands_update') {
            fetchPendingTasks();
            setActiveTab('automation'); // pull focus
          } else if (data.event === 'command_executed') {
            // Move from pending to completed
            const { task_id, result } = data;
            setPendingTasks(prev => prev.filter(t => t.id !== task_id));
            
            // Look up task details in pending list to retain description
            const originalTask = pendingTasks.find(t => t.id === task_id);
            setCompletedTasks(prev => ({
              ...prev,
              [task_id]: {
                id: task_id,
                command: originalTask?.command || 'Unknown Command',
                description: originalTask?.description || 'Executed Command',
                code: originalTask?.code || null,
                status: 'completed',
                result
              }
            }));
          } else if (data.event === 'command_rejected') {
            const { task_id } = data;
            setPendingTasks(prev => prev.filter(t => t.id !== task_id));
          }
        } catch (e) {
          console.error("WebSocket message parse error: ", e);
        }
      };

      socket.onclose = () => {
        console.log("WebSocket disconnected. Retrying in 5 seconds...");
        setTimeout(connectWebSocket, 5000);
      };

      socket.onerror = (err) => {
        console.error("WebSocket encountered error: ", err);
      };
    };

    connectWebSocket();

    return () => {
      if (socket) socket.close();
    };
  }, [pendingTasks]);

  // Run initial diagnostics
  useEffect(() => {
    const startup = async () => {
      const isOnline = await checkServerStatus();
      if (isOnline) {
        fetchChatHistory();
        fetchMemories();
        fetchPendingTasks();
      }
    };
    startup();
    
    // Periodically poll system status
    const pollInterval = setInterval(checkServerStatus, 5000);
    return () => clearInterval(pollInterval);
  }, []);

  // --- Voice Service Loop ---

  useEffect(() => {
    // Initialize browser speech recognition exactly once on mount
    const success = voiceService.initRecognition(
      async (transcript) => {
        const text = transcript.toLowerCase();
        
        const isManuallyListening = companionStateRef.current === 'listening';

        if (isManuallyListening) {
          if (transcript.trim() && handleSendMessageRef.current) {
            await handleSendMessageRef.current(transcript.trim());
          }
        } else if (wakeWordEnabledRef.current && (
          text.includes("hey ally") || text.includes("ally") ||
          text.includes("hey jarvis") || text.includes("jarvis")
        )) {
          playWakeSound();
          setCompanionState('listening');
          
          // Isolate user instructions after wake word
          let query = '';
          if (text.includes("hey ally")) {
            query = transcript.substring(text.indexOf("hey ally") + 8).trim();
          } else if (text.includes("ally")) {
            query = transcript.substring(text.indexOf("ally") + 4).trim();
          } else if (text.includes("hey jarvis")) {
            query = transcript.substring(text.indexOf("hey jarvis") + 10).trim();
          } else if (text.includes("jarvis")) {
            query = transcript.substring(text.indexOf("jarvis") + 6).trim();
          }

          // Clean symbols
          query = query.replace(/^[,.?!]/, '').trim();

          if (query) {
            // Trigger request directly with voice text
            if (handleSendMessageRef.current) {
              await handleSendMessageRef.current(query);
            }
          } else {
            // Wake word with no instruction - Greet user
            setCompanionState('speaking');
            const greeting = jarvisModeRef.current
              ? "System initialized. Online and ready, sir. How can I assist you?"
              : "Hello! I'm Ally. How can I help you today?";
            if (handleVoiceOutputRef.current) {
              handleVoiceOutputRef.current(greeting);
            }
          }
        }
      },
      (listeningState) => {
        if (!listeningState && companionStateRef.current === 'listening') {
          setCompanionState('idle');
        }
      }
    );

    // Initial load start if wakeWordEnabled is true
    if (success && wakeWordEnabledRef.current) {
      // Find voice lang dynamically
      let voiceLang = 'en-US';
      if (window.speechSynthesis) {
        const selectedName = localStorage.getItem('ally_voice');
        const match = window.speechSynthesis.getVoices().find(v => v.name === selectedName);
        if (match) voiceLang = match.lang;
      }
      voiceService.startListening(voiceLang);
    }

    return () => {
      voiceService.stopListening();
    };
  }, []); // Run exactly once on mount

  // Control speech listening state dynamically when wakeWordEnabled toggles
  useEffect(() => {
    if (wakeWordEnabled) {
      let voiceLang = 'en-US';
      if (typeof window !== 'undefined' && window.speechSynthesis && selectedVoice) {
        const match = window.speechSynthesis.getVoices().find(v => v.name === selectedVoice);
        if (match) voiceLang = match.lang;
      }
      voiceService.startListening(voiceLang);
    } else {
      voiceService.stopListening();
    }
  }, [wakeWordEnabled]);

  // --- UI Action Handlers ---

  const handleSendMessage = async (text) => {
    if (isLoading) return;
    
    setIsLoading(true);
    setCompanionState('thinking');
    
    // Add to message log in UI immediately
    setMessages(prev => [...prev, { role: 'user', content: text, timestamp: new Date().toISOString() }]);
    setInputValue('');

    // Pre-screen grab if vision is toggled
    let triggerVision = useVision;
    if (useVision) {
      try {
        // Trigger capture screenshot endpoint before calling chat
        await fetch('/api/screen');
        setUseVision(false); // Reset vision checkbox
      } catch (e) {
        console.error("Failed to capture active screen: ", e);
        triggerVision = false;
      }
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: text,
          use_vision: triggerVision,
          ollama_host: ollamaHost,
          ollama_model: ollamaModel,
          ollama_vision_model: ollamaVisionModel,
          provider: provider,
          gemini_api_key: geminiApiKey
        })
      });

      if (res.ok) {
        const data = await res.json();
        
        // Save reply & speak if enabled
        setMessages(prev => [...prev, { role: 'assistant', content: data.response, timestamp: new Date().toISOString() }]);
        
        // Reload system updates (memories/tasks might change)
        fetchMemories();
        fetchPendingTasks();

        if (voiceEnabled) {
          setCompanionState('speaking');
          handleVoiceOutput(data.response);
        } else {
          setCompanionState('idle');
        }
      } else {
        const errText = await res.text();
        setMessages(prev => [...prev, { role: 'assistant', content: `Core server error: ${errText}`, timestamp: new Date().toISOString() }]);
        setCompanionState('idle');
      }
    } catch (e) {
      console.error("Chat communication failed: ", e);
      setMessages(prev => [...prev, { role: 'assistant', content: "Failed to communicate with local server.", timestamp: new Date().toISOString() }]);
      setCompanionState('idle');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceOutput = (text) => {
    // Generate voice oscillations
    clearInterval(amplitudeIntervalRef.current);
    amplitudeIntervalRef.current = setInterval(() => {
      setAmplitude(0.1 + Math.random() * 0.85);
    }, 100);

    voiceService.speak(
      text,
      selectedVoice,
      speechRate,
      null, // onStart
      () => {
        // onEnd
        clearInterval(amplitudeIntervalRef.current);
        setAmplitude(0);
        setCompanionState('idle');
      }
    );
  };

  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

  useEffect(() => {
    handleVoiceOutputRef.current = handleVoiceOutput;
  }, [handleVoiceOutput]);

  const handleToggleMic = () => {
    if (companionState === 'listening') {
      voiceService.stopListening();
      setCompanionState('idle');
    } else {
      setCompanionState('listening');
      let voiceLang = 'en-US';
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const selectedName = localStorage.getItem('ally_voice') || selectedVoice;
        const match = window.speechSynthesis.getVoices().find(v => v.name === selectedName);
        if (match) {
          voiceLang = match.lang;
        } else {
          // Fallback to Indian English if available
          const indianMatch = window.speechSynthesis.getVoices().find(v => {
            const name = v.name.toLowerCase();
            const lang = v.lang.toLowerCase();
            return lang.startsWith('en-in') || name.includes('india') || name.includes('indian');
          });
          if (indianMatch) voiceLang = indianMatch.lang;
        }
      }
      voiceService.startListening(voiceLang);
    }
  };

  const handleClearHistory = async () => {
    try {
      const res = await fetch('/api/chat/history', { method: 'DELETE' });
      if (res.ok) {
        setMessages([]);
      }
    } catch (e) {
      console.error("Could not clear history: ", e);
    }
  };

  const handleSaveOllamaSettings = (host, model, visionModel) => {
    setOllamaHost(host);
    setOllamaModel(model);
    setOllamaVisionModel(visionModel);
    localStorage.setItem('ally_ollama_host', host);
    localStorage.setItem('ally_ollama_model', model);
    localStorage.setItem('ally_ollama_vision_model', visionModel);
  };

  // --- Automation executions ---

  const handleApproveCommand = async (taskId) => {
    try {
      const res = await fetch(`/api/system/approve/${taskId}`, { method: 'POST' });
      if (res.ok) {
        fetchPendingTasks();
      }
    } catch (e) {
      console.error("Command approval endpoint failed: ", e);
    }
  };

  const handleRejectCommand = async (taskId) => {
    try {
      const res = await fetch(`/api/system/reject/${taskId}`, { method: 'POST' });
      if (res.ok) {
        fetchPendingTasks();
      }
    } catch (e) {
      console.error("Command rejection failed: ", e);
    }
  };

  // --- Memory Operations ---

  const handleAddMemory = async (key, value, category) => {
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, category })
      });
      if (res.ok) {
        fetchMemories();
      }
    } catch (e) {
      console.error("Memory saving failed: ", e);
    }
  };

  const handleDeleteMemory = async (memoryId) => {
    try {
      const res = await fetch(`/api/memory/${memoryId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchMemories();
      }
    } catch (e) {
      console.error("Memory deletion failed: ", e);
    }
  };

  if (jarvisMode) {
    return (
      <div className="jarvis-container" style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        padding: '1.5rem',
        gap: '1rem',
        color: '#00b4d8'
      }}>
        <div className="jarvis-scanline"></div>
        
        {/* Top HUD bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0, 180, 216, 0.3)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="glow-blue" style={{ fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>JARVIS SYSTEM v3.5</div>
            <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', background: 'rgba(0,180,216,0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(0,180,216,0.3)' }}>ONLINE</span>
          </div>
          
          <button
            onClick={() => setJarvisMode(false)}
            className="hud-panel"
            style={{
              padding: '0.4rem 1rem',
              fontSize: '0.75rem',
              color: '#00b4d8',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              border: '1px solid rgba(0, 180, 216, 0.4)',
              borderRadius: '6px'
            }}
          >
            [ DEACTIVATE HUD MODE ]
          </button>
        </div>

        {/* Main HUD Body */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1.8fr 1fr', gap: '1.5rem', height: 'calc(100% - 4rem)' }}>
          
          {/* Left Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
            <div className="hud-panel" style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <span className="hud-title">SYSTEM STATUS</span>
              <div style={{ borderBottom: '1px solid rgba(0, 180, 216, 0.1)', paddingBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.65rem', color: 'rgba(0,180,216,0.6)' }}>CORE AI ENGINE</div>
                <div className="hud-value glow-blue" style={{ fontSize: '0.95rem' }}>{provider === 'gemini' ? 'GOOGLE GEMINI 2.5' : 'LOCAL OLLAMA ENGINE'}</div>
              </div>
              <div style={{ borderBottom: '1px solid rgba(0, 180, 216, 0.1)', paddingBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.65rem', color: 'rgba(0,180,216,0.6)' }}>SPEECH SYNTHESIS</div>
                <div className="hud-value" style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedVoice ? selectedVoice : 'Default System Voice'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(0,180,216,0.6)' }}>MIC LISTENING</div>
                <div className="hud-value glow-blue" style={{ color: companionState === 'listening' ? '#10b981' : '#00b4d8', fontSize: '0.95rem' }}>
                  {companionState === 'listening' ? '● RECORDING / INGESTING' : '○ STANDBY'}
                </div>
              </div>
            </div>
            
            <div className="hud-panel" style={{ padding: '1rem', flex: 1.2, overflowY: 'auto' }}>
              <span className="hud-title">HARDWARE UTILIZATION</span>
              <SystemStats />
            </div>
          </div>

          {/* Center Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <div style={{ position: 'relative', width: '320px', height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* Outer ring */}
              <div className="rotate-cw" style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: '2px dashed rgba(0, 180, 216, 0.25)',
                boxShadow: '0 0 20px rgba(0, 180, 216, 0.05)'
              }}></div>
              {/* Middle ring */}
              <div className="rotate-ccw" style={{
                position: 'absolute',
                width: '82%',
                height: '82%',
                borderRadius: '50%',
                border: '1px solid rgba(0, 180, 216, 0.4)',
                borderTopColor: 'transparent',
                borderBottomColor: 'transparent'
              }}></div>
              {/* Inner ring */}
              <div className="rotate-cw" style={{
                position: 'absolute',
                width: '66%',
                height: '66%',
                borderRadius: '50%',
                border: '2px dotted rgba(0, 180, 216, 0.6)'
              }}></div>
              
              <div style={{ position: 'relative', zIndex: 5, width: '130px', height: '130px' }}>
                <OrbVisualizer state={companionState} amplitude={amplitude} />
              </div>
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', width: '90%' }}>
              <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'rgba(0,180,216,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {companionState === 'listening' ? 'INGESTING SPEECH INPUT' : companionState === 'thinking' ? 'PROCESSING RESPONSE' : companionState === 'speaking' ? 'TRANSMITTING VOICE SYNTHESIS' : 'SYSTEM SLEEPING - CLICK CORE TO WAKE'}
              </span>
              
              <div style={{
                width: '100%',
                padding: '0.8rem 1.2rem',
                borderRadius: '8px',
                border: '1px solid rgba(0, 180, 216, 0.15)',
                background: 'rgba(10, 25, 47, 0.25)',
                minHeight: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                fontSize: '0.85rem',
                fontFamily: 'var(--font-mono)',
                color: '#f4f4f9',
                textShadow: '0 0 5px rgba(0, 180, 216, 0.3)',
                overflowY: 'auto',
                maxHeight: '120px'
              }}>
                {companionState === 'listening' ? (
                  <span style={{ color: '#10b981' }}>[ Listening... Speak now, sir ]</span>
                ) : companionState === 'thinking' ? (
                  <span className="animate-pulse">Thinking... Analyzing request details</span>
                ) : companionState === 'speaking' && messages.length > 0 ? (
                  <span>{messages[messages.length - 1].content}</span>
                ) : (
                  <span style={{ color: 'rgba(0,180,216,0.5)' }}>"Hey Jarvis, open notepad" or click the mic to speak</span>
                )}
              </div>

              <button
                onClick={handleToggleMic}
                style={{
                  marginTop: '1rem',
                  width: '45px',
                  height: '45px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: companionState === 'listening' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0, 180, 216, 0.1)',
                  border: '1px solid',
                  borderColor: companionState === 'listening' ? '#10b981' : 'rgba(0, 180, 216, 0.4)',
                  color: companionState === 'listening' ? '#10b981' : '#00b4d8',
                  cursor: 'pointer',
                  boxShadow: companionState === 'listening' ? '0 0 15px rgba(16, 185, 129, 0.4)' : 'none'
                }}
              >
                {companionState === 'listening' ? <Volume2 size={20} /> : <Mic size={20} />}
              </button>
            </div>
          </div>

          {/* Right Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflow: 'hidden' }}>
            <div className="hud-panel" style={{ padding: '1rem', flex: 1.2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <span className="hud-title" style={{ marginBottom: '0.5rem' }}>COCKPIT AUTONOMOUS ACTIONS</span>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <AutomationPanel
                  pendingTasks={pendingTasks}
                  completedTasks={completedTasks}
                  onApprove={handleApproveCommand}
                  onReject={handleRejectCommand}
                />
              </div>
            </div>
            
            <div className="hud-panel" style={{ padding: '1rem', flex: 0.8, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <span className="hud-title" style={{ marginBottom: '0.5rem' }}>LONG-TERM MEMORY BANK</span>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <MemoryHub
                  memories={memories}
                  onAddMemory={handleAddMemory}
                  onDeleteMemory={handleDeleteMemory}
                  onRefresh={fetchMemories}
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '320px 1fr 380px',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      padding: '1.25rem',
      gap: '1.25rem'
    }}>
      
      {/* LEFT PANEL: Companion Orb & Settings Shortcut */}
      <div className="glass-panel" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        padding: '1.5rem',
        overflow: 'hidden'
      }}>
        {/* Brand header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '1.1rem',
            color: 'white',
            fontFamily: 'var(--font-mono)'
          }}>A</div>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.02em' }}>Ally Companion</h1>
            <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>DESKTOP INTELLIGENCE v1.0</span>
          </div>
          
          <button
            onClick={() => setJarvisMode(true)}
            style={{
              padding: '0.3rem 0.6rem',
              fontSize: '0.65rem',
              fontWeight: 'bold',
              fontFamily: 'var(--font-mono)',
              border: '1px solid rgba(0, 180, 216, 0.4)',
              background: 'rgba(0, 180, 216, 0.15)',
              color: '#00b4d8',
              borderRadius: '6px',
              cursor: 'pointer',
              marginLeft: 'auto'
            }}
          >
            🤖 JARVIS HUD
          </button>
        </div>

        {/* Floating animated orb */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-float">
            <OrbVisualizer state={companionState} amplitude={amplitude} />
          </div>
        </div>

        {/* Small settings shortcut button tray */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.5rem',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '1rem'
        }}>
          <button
            onClick={() => setActiveTab('automation')}
            style={{
              padding: '0.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: activeTab === 'automation' ? 'var(--accent-purple-glow)' : 'transparent',
              border: '1px solid',
              borderColor: activeTab === 'automation' ? 'var(--accent-purple)' : 'transparent',
              color: activeTab === 'automation' ? 'var(--text-primary)' : 'var(--text-muted)',
              borderRadius: '8px'
            }}
            title="Automation Center"
          >
            <Terminal size={18} />
          </button>
          <button
            onClick={() => setActiveTab('memory')}
            style={{
              padding: '0.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: activeTab === 'memory' ? 'var(--accent-purple-glow)' : 'transparent',
              border: '1px solid',
              borderColor: activeTab === 'memory' ? 'var(--accent-purple)' : 'transparent',
              color: activeTab === 'memory' ? 'var(--text-primary)' : 'var(--text-muted)',
              borderRadius: '8px'
            }}
            title="Memory Bank"
          >
            <Brain size={18} />
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            style={{
              padding: '0.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: activeTab === 'settings' ? 'var(--accent-purple-glow)' : 'transparent',
              border: '1px solid',
              borderColor: activeTab === 'settings' ? 'var(--accent-purple)' : 'transparent',
              color: activeTab === 'settings' ? 'var(--text-primary)' : 'var(--text-muted)',
              borderRadius: '8px'
            }}
            title="System Settings"
          >
            <SettingsIcon size={18} />
          </button>
          
          {/* Quick status dot */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.65rem',
            fontFamily: 'var(--font-mono)',
            color: serverOnline ? 'var(--accent-emerald)' : 'var(--accent-rose)'
          }}>
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: serverOnline ? 'var(--accent-emerald)' : 'var(--accent-rose)',
              marginRight: '4px',
              boxShadow: serverOnline ? '0 0 10px var(--accent-emerald)' : 'none'
            }}></span>
            {serverOnline ? 'LIVE' : 'OFF'}
          </div>
        </div>
      </div>

      {/* CENTER PANEL: Main Conversation Log Console */}
      <div style={{ height: '100%', overflow: 'hidden' }}>
        <ChatWindow
          messages={messages}
          inputValue={inputValue}
          setInputValue={setInputValue}
          onSendMessage={handleSendMessage}
          isListening={companionState === 'listening'}
          toggleListening={handleToggleMic}
          useVision={useVision}
          setUseVision={setUseVision}
          onClearHistory={handleClearHistory}
          isLoading={isLoading}
        />
      </div>

      {/* RIGHT PANEL: Sideboards for Context (Automation, Memory, Settings) */}
      <div style={{ height: '100%', overflow: 'hidden' }}>
        {activeTab === 'automation' && (
          <AutomationPanel
            pendingTasks={pendingTasks}
            completedTasks={completedTasks}
            onApprove={handleApproveCommand}
            onReject={handleRejectCommand}
          />
        )}
        
        {activeTab === 'memory' && (
          <MemoryHub
            memories={memories}
            onAddMemory={handleAddMemory}
            onDeleteMemory={handleDeleteMemory}
            onRefresh={fetchMemories}
          />
        )}

        {activeTab === 'settings' && (
          <Settings
            ollamaHost={ollamaHost}
            ollamaModel={ollamaModel}
            ollamaVisionModel={ollamaVisionModel}
            onSaveOllamaSettings={handleSaveOllamaSettings}
            voiceEnabled={voiceEnabled}
            setVoiceEnabled={setVoiceEnabled}
            wakeWordEnabled={wakeWordEnabled}
            setWakeWordEnabled={setWakeWordEnabled}
            selectedVoice={selectedVoice}
            setSelectedVoice={setSelectedVoice}
            speechRate={speechRate}
            setSpeechRate={setSpeechRate}
            serverOnline={serverOnline}
            provider={provider}
            setProvider={setProvider}
            geminiApiKey={geminiApiKey}
            setGeminiApiKey={setGeminiApiKey}
          />
        )}
      </div>

    </div>
  );
}
