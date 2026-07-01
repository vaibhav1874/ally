import React, { useState, useEffect } from 'react';
import { Brain, Plus, Trash2, Tag, RefreshCw } from 'lucide-react';

export default function MemoryHub({ memories = [], onAddMemory = () => {}, onDeleteMemory = () => {}, onRefresh = () => {} }) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState('general');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newKey.trim() && newValue.trim()) {
      onAddMemory(newKey.trim(), newValue.trim(), newCategory);
      setNewKey('');
      setNewValue('');
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1rem', height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Brain size={18} color="var(--accent-purple)" />
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Long-Term Memory Hub</span>
        </div>
        <button onClick={onRefresh} style={{ background: 'transparent', color: 'var(--text-muted)' }} title="Refresh Database">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Manual Memory Creator Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} className="glass-card">
        <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>ADD FACT MANUALLY</span>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <input
            type="text"
            placeholder="Fact name (e.g. name)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
          />
          <input
            type="text"
            placeholder="Details (e.g. Vaibhav)"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', background: '#12121f' }}
          >
            <option value="general">General</option>
            <option value="preference">Preferences</option>
            <option value="project">Projects</option>
            <option value="system">System</option>
          </select>
          <button type="submit" className="btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Plus size={12} />
            <span>Store</span>
          </button>
        </div>
      </form>

      {/* Memory List */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '350px' }}>
        {memories.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '120px', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
            <span>No memories recorded yet.</span>
            <span style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>Ask Ally to remember something and it will appear here.</span>
          </div>
        ) : (
          memories.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.6rem 0.75rem',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxWidth: '85%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{
                    fontSize: '0.65rem',
                    fontFamily: 'var(--font-mono)',
                    backgroundColor: m.category === 'preference' ? 'var(--accent-blue-glow)' :
                                      m.category === 'project' ? 'var(--accent-purple-glow)' :
                                      'rgba(255,255,255,0.06)',
                    color: m.category === 'preference' ? 'var(--accent-blue)' :
                           m.category === 'project' ? 'var(--accent-purple)' :
                           'var(--text-secondary)',
                    padding: '0.1rem 0.3rem',
                    borderRadius: '4px',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    {m.category}
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{m.key}</span>
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{m.value}</span>
              </div>
              
              <button
                onClick={() => onDeleteMemory(m.id)}
                style={{ background: 'transparent', color: 'var(--text-muted)' }}
                className="btn-delete"
                title="Delete fact"
              >
                <Trash2 size={13} style={{ transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = 'var(--accent-rose)'} onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
