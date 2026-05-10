import { QRCodeSVG } from 'qrcode.react'

export default function SosQrCode() {
  const host = import.meta.env.VITE_SOS_HOST || window.location.hostname
  const { port, protocol } = window.location
  const url = `${protocol}//${host}${port ? `:${port}` : ''}/sos`

  return (
    <div style={{
      position: 'fixed',
      top: 56,
      right: 12,
      zIndex: 200,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      padding: '10px 12px',
      background: '#111827',
      border: '1px solid rgba(239,68,68,0.5)',
      borderRadius: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    }}>
      <QRCodeSVG
        value={url}
        size={96}
        bgColor="#111827"
        fgColor="#f9fafb"
        level="M"
      />
      <span style={{ fontSize: 10, color: '#ef4444', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
        Scan to report emergency
      </span>
    </div>
  )
}
