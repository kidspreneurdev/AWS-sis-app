import { useState, useEffect } from 'react'
import { _registerToastHandler, type ToastType } from '@/lib/toast'

interface ToastItem { id: number; msg: string; type: ToastType }

const META: Record<ToastType, { bg: string; tc: string; icon: string }> = {
  ok:   { bg: '#E8FBF0', tc: '#0E6B3B', icon: '✓' },
  err:  { bg: '#FFF0F1', tc: '#D61F31', icon: '✕' },
  info: { bg: '#E6F4FF', tc: '#0369A1', icon: 'ℹ' },
}

let _nextId = 0

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    _registerToastHandler((msg, type) => {
      const id = ++_nextId
      setToasts(p => [...p, { id, msg, type }])
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 2800)
    })
  }, [])

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => {
        const m = META[t.type]
        return (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 18px', borderRadius: 10,
            background: m.bg, color: m.tc,
            border: `1px solid ${m.tc}44`,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            fontSize: 13, fontWeight: 600,
            animation: 'slideUp 0.2s ease',
            pointerEvents: 'auto',
          }}>
            <span style={{
              width: 20, height: 20, borderRadius: '50%',
              background: m.tc, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, flexShrink: 0,
            }}>{m.icon}</span>
            {t.msg}
          </div>
        )
      })}
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  )
}
