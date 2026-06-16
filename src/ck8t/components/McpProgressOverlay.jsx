import React from 'react';
import { useMcpProgressStore } from '../stores/mcp-progress-store';

export default function McpProgressOverlay() {
  const active = useMcpProgressStore((s) => s.active);
  if (!active) return null;

  const { serverName, toolName, step, total, pct } = active;

  return (
    <div className="bs-mcp-progress-overlay">
      <div className="bs-mcp-progress-header">
        <span className="bs-mcp-progress-spinner" />
        <span className="bs-mcp-progress-title">
          {serverName} <span className="bs-mcp-progress-tool">· {toolName}</span>
        </span>
        <span className="bs-mcp-progress-pct">{pct}%</span>
      </div>
      <div className="bs-mcp-progress-track">
        <div className="bs-mcp-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="bs-mcp-progress-steps">
        step {step} / {total}
      </div>
    </div>
  );
}
