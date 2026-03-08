import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'VibeHosting — простейший хостинг для сайтов';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          color: 'white',
          padding: '60px',
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 800, marginBottom: 24, display: 'flex' }}>
          VibeHosting
        </div>
        <div style={{ fontSize: 36, opacity: 0.9, textAlign: 'center', display: 'flex' }}>
          Твой сайт в интернете за 5 минут
        </div>
        <div style={{ fontSize: 24, opacity: 0.7, marginTop: 16, display: 'flex' }}>
          hostingvibe.ru
        </div>
      </div>
    ),
    { ...size },
  );
}
