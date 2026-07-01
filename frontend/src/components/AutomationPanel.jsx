import React, { useState } from 'react';
import { Terminal, ShieldAlert, Check, X, ChevronDown, ChevronUp } from 'lucide-react';

export default function AutomationPanel({
  pendingTasks = [],
  completedTasks = {},
  onApprove = () => {},
  onReject = () => {}
}) {
  const [expandedTask, setExpandedTask] = useState(null);

  const toggleExpand = (taskId) => {
    if (expandedTask === taskId) {
      setExpandedTask(null);
    } else {
      setExpandedTask(taskId);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1rem', height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <Terminal size={18} color="var(--accent-blue)" />
        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Automation Center</span>
      </div>

      {/* Verification Shield notice */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
        backgroundColor: 'rgba(245, 158, 11, 0.06)',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        borderRadius: '8px',
        padding: '0.6rem 0.8rem',
        fontSize: '0.75rem',
        color: 'var(--accent-amber)'
      }}>
        <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong>Security Shield Active:</strong> Shell commands suggested by Ally will not run until you review and explicitly click approve.
        </div>
      </div>

      {/* Queue items */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px' }}>
        {pendingTasks.length === 0 && Object.keys(completedTasks).length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '120px', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
            <span>No automation actions pending.</span>
            <span style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>Commands queued by Ally will ask for authorization here.</span>
          </div>
        ) : (
          <>
            {/* Pending commands */}
            {pendingTasks.map((task) => (
              <div
                key={task.id}
                style={{
                  border: '1px solid rgba(157, 78, 221, 0.35)',
                  backgroundColor: 'rgba(157, 78, 221, 0.03)',
                  borderRadius: '10px',
                  padding: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxWidth: '75%' }}>
                    <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)', fontWeight: 'bold' }}>APPROVAL REQUIRED</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{task.description}</span>
                  </div>
                  
                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button
                      onClick={() => onApprove(task.id)}
                      style={{
                        padding: '0.4rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'var(--accent-emerald-glow)',
                        border: '1px solid var(--accent-emerald)',
                        color: 'var(--accent-emerald)',
                        borderRadius: '6px'
                      }}
                      title="Approve & Run"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => onReject(task.id)}
                      style={{
                        padding: '0.4rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(244, 63, 94, 0.1)',
                        border: '1px solid var(--accent-rose)',
                        color: 'var(--accent-rose)',
                        borderRadius: '6px'
                      }}
                      title="Reject"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                <div style={{
                  background: '#07070a',
                  border: '1px solid var(--border-color)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  color: '#22c55e',
                  wordBreak: 'break-all'
                }}>
                  $ {task.command}
                </div>
              </div>
            ))}

            {/* Completed commands */}
            {Object.values(completedTasks).map((task) => {
              const hasOutput = task.result && (task.result.stdout || task.result.stderr);
              const isExpanded = expandedTask === task.id;
              const isError = task.result && task.result.exit_code !== 0;

              return (
                <div
                  key={task.id}
                  style={{
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'rgba(255, 255, 255, 0.01)',
                    borderRadius: '8px',
                    padding: '0.6rem 0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                      <span style={{
                        fontSize: '0.65rem',
                        fontFamily: 'var(--font-mono)',
                        color: task.status === 'completed' && !isError ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                        fontWeight: 'bold'
                      }}>
                        {task.status === 'completed' && !isError ? 'EXECUTED SUCCESSFULLY' : 'EXECUTION FAILED'}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{task.description}</span>
                    </div>
                    {hasOutput && (
                      <button
                        onClick={() => toggleExpand(task.id)}
                        style={{ background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    )}
                  </div>

                  <div style={{
                    background: '#07070a',
                    border: '1px solid var(--border-color)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    padding: '0.4rem',
                    borderRadius: '6px',
                    color: 'var(--text-secondary)',
                    overflowX: 'auto',
                    whiteSpace: 'pre'
                  }}>
                    $ {task.command}
                  </div>

                  {/* Render output terminal if expanded */}
                  {isExpanded && hasOutput && (
                    <div style={{
                      backgroundColor: '#030305',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '0.5rem',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.7rem',
                      maxHeight: '150px',
                      overflowY: 'auto',
                      color: isError ? '#ef4444' : '#e4e4e7',
                      marginTop: '0.2rem'
                    }}>
                      {task.result.stderr && (
                        <div style={{ color: '#ef4444', marginBottom: '0.25rem' }}>
                          [STDERR] {task.result.stderr}
                        </div>
                      )}
                      {task.result.stdout && (
                        <div>
                          [STDOUT] {task.result.stdout}
                        </div>
                      )}
                      <div style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.65rem' }}>
                        Exit code: {task.result.exit_code}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
