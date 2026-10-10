import { useCallback, useEffect, useState } from 'react'
import { getProfile, initSeed } from './db'
import type { Profile } from './types'
import { computeAll, type Computed } from './lib/compute'
import Setup from './pages/Setup'
import Today from './pages/Today'
import Train from './pages/Train'
import Trend from './pages/Trend'
import Settings from './pages/Settings'

type Tab = 'today' | 'train' | 'trend' | 'settings'

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'today', icon: '◉', label: '今天' },
  { key: 'train', icon: '▤', label: '训练' },
  { key: 'trend', icon: '◪', label: '趋势' },
  { key: 'settings', icon: '⚙', label: '设置' }
]

export default function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [computed, setComputed] = useState<Computed | null>(null)
  const [tab, setTab] = useState<Tab>('today')

  const refresh = useCallback(async () => {
    const p = await getProfile()
    setProfile(p ?? null)
    setComputed(p?.setupDone ? await computeAll(p) : null)
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        await initSeed()
        await refresh()
      } catch (e) {
        console.error(e)
        setError(
          e instanceof Error ? `${e.name}: ${e.message}` : String(e)
        )
      } finally {
        setReady(true)
      }
    })()
  }, [refresh])

  if (error) {
    return (
      <div className="empty">
        启动失败
        <div style={{ marginTop: 10, color: 'var(--bad)', fontSize: 12.5, wordBreak: 'break-all' }}>
          {error}
        </div>
      </div>
    )
  }

  if (!ready) {
    return <div className="empty">加载中…</div>
  }

  if (!profile || !profile.setupDone || !computed) {
    return <Setup onDone={refresh} />
  }

  return (
    <div className="app">
      {tab === 'today' && <Today profile={profile} computed={computed} onChanged={refresh} />}
      {tab === 'train' && <Train onChanged={refresh} />}
      {tab === 'trend' && <Trend profile={profile} computed={computed} onChanged={refresh} />}
      {tab === 'settings' && (
        <Settings profile={profile} computed={computed} onChanged={refresh} />
      )}

      <nav className="tabbar">
        <div className="tabbar-inner">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <span className="tab-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
