import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, RefreshCw } from 'lucide-react';

export default function SystemStats({ serverOnline = false }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/system/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("Failed to load system stats: ", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (serverOnline) {
      fetchStats();
      const interval = setInterval(fetchStats, 3000);
      return () => clearInterval(interval);
    }
  }, [serverOnline]);

  if (!serverOnline) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>
        Start core server to load hardware statistics.
      </div>
    );
  }

  if (loading || !stats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
        <RefreshCw size={14} style={{ animation: 'spin-slow 2s linear infinite', marginRight: '0.5rem' }} />
        <span style={{ fontSize: '0.8rem' }}>Loading hardware stats...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }} className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' }}>
        <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>HARDWARE MONITOR</span>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>OS: {stats.os} {stats.os_release}</span>
      </div>

      {/* CPU */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Cpu size={14} color="var(--accent-purple)" />
            <span>Processor Load</span>
          </span>
          <span style={{ fontWeight: 'bold', color: 'var(--accent-purple)' }}>{stats.cpu_percent}%</span>
        </div>
        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${stats.cpu_percent}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-purple), var(--accent-blue))', borderRadius: '3px', transition: 'width 0.5s ease-out' }}></div>
        </div>
      </div>

      {/* RAM */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
          <span>Memory Usage</span>
          <span style={{ fontWeight: 'bold' }}>{stats.ram_used_gb} / {stats.ram_total_gb} GB ({stats.ram_percent}%)</span>
        </div>
        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${stats.ram_percent}%`, height: '100%', background: 'var(--accent-blue)', borderRadius: '3px', transition: 'width 0.5s ease-out' }}></div>
        </div>
      </div>

      {/* Disk */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <HardDrive size={14} color="var(--text-secondary)" />
            <span>Disk Space</span>
          </span>
          <span>{stats.disk_used_gb} / {stats.disk_total_gb} GB ({stats.disk_percent}%)</span>
        </div>
        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${stats.disk_percent}%`, height: '100%', background: 'var(--text-secondary)', borderRadius: '3px', transition: 'width 0.5s ease-out' }}></div>
        </div>
      </div>
    </div>
  );
}
