import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          backgroundColor: '#090d16',
          backgroundImage:
            'radial-gradient(circle at 25px 25px, #1e293b 2%, transparent 0%), radial-gradient(circle at 75px 75px, #0f172a 2%, transparent 0%)',
          backgroundSize: '100px 100px',
          padding: '64px',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '60px',
              height: '60px',
              borderRadius: '16px',
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              fontSize: '28px',
              fontWeight: 800,
              boxShadow: '0 10px 25px rgba(79, 70, 229, 0.4)',
            }}
          >
            RP
          </div>
          <span
            style={{
              fontSize: '34px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#ffffff',
            }}
          >
            RetailPilot AI
          </span>
          <span
            style={{
              marginLeft: '12px',
              padding: '6px 14px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(79, 70, 229, 0.2)',
              border: '1px solid rgba(129, 140, 248, 0.3)',
              color: '#a5b4fc',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            Enterprise Retail SaaS
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1000px' }}>
          <h1
            style={{
              fontSize: '52px',
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              color: '#f8fafc',
              margin: 0,
            }}
          >
            Intelligent Inventory Ledger, POS & Autonomous AI Operations
          </h1>
          <p
            style={{
              fontSize: '24px',
              lineHeight: 1.4,
              color: '#94a3b8',
              margin: 0,
            }}
          >
            Double-entry inventory accounting, high-speed retail checkout, automated stock alerts,
            and Model Context Protocol (MCP) AI assistants.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '28px',
            borderTop: '1px solid #1e293b',
            paddingTop: '28px',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }} />
            <span style={{ fontSize: '18px', color: '#cbd5e1', fontWeight: 600 }}>Immutable FIFO Ledger</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#6366f1' }} />
            <span style={{ fontSize: '18px', color: '#cbd5e1', fontWeight: 600 }}>Real-Time POS & Returns</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#38bdf8' }} />
            <span style={{ fontSize: '18px', color: '#cbd5e1', fontWeight: 600 }}>Model Context Protocol (MCP)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
            <span style={{ fontSize: '18px', color: '#cbd5e1', fontWeight: 600 }}>Multi-Tenant PostgreSQL RLS</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
