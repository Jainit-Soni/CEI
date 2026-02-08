export default function Loading() {
    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'white',
            zIndex: 9999
        }}>
            <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid #e2e8f0',
                borderTopColor: '#4f46e5',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
            }} />
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
