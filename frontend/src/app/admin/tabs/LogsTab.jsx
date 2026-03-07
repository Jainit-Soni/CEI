"use client";

export default function LogsTab({ logs }) {
    return (
        <div className="reveal revealed">
            <div className="admin-terminal">
                <div className="admin-terminal-header">
                    <div className="admin-terminal-dots">
                        <div className="admin-terminal-dot" style={{ background: '#ef4444' }}></div>
                        <div className="admin-terminal-dot" style={{ background: '#eab308' }}></div>
                        <div className="admin-terminal-dot" style={{ background: '#22c55e' }}></div>
                    </div>
                    <span className="admin-terminal-path">production / root / var / log / sys.log</span>
                </div>
                <div className="admin-terminal-body">
                    {logs.map((log, i) => {
                        let textColor = "#e2e8f0";
                        if (log.includes("[SEC]")) textColor = "#f43f5e";
                        if (log.includes("[SYS]")) textColor = "#34d399";
                        if (log.includes("[ML]")) textColor = "#818cf8";
                        if (log.includes("[OP]")) textColor = "#fbbf24";

                        return (
                            <div key={i} className="log-line" style={{ color: textColor }}>
                                <span className="log-time">{new Date().toISOString()}</span>
                                <span>{log}</span>
                            </div>
                        );
                    })}
                    <div style={{ color: '#64748b', marginTop: '16px', animation: 'pulse 2s infinite' }}>_ blinking cursor waiting...</div>
                </div>
            </div>
        </div>
    );
}
