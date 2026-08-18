import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { useDataStore } from '../store/useDataStore'
import type { AttendanceSession } from '../data/types'

const ROTATE_SECONDS = 30

/** A deterministic block pattern standing in for a real QR image. */
function QrArt({ seed, size }: { seed: string; size: number }) {
  const cells = 21
  const bits: boolean[] = []
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = (h ^ seed.charCodeAt(i)) * 16777619
  for (let i = 0; i < cells * cells; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff
    bits.push((h >> 8) % 100 < 48)
  }
  const px = size / cells
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded bg-white">
      {bits.map((on, i) =>
        on ? (
          <rect
            key={i}
            x={(i % cells) * px}
            y={Math.floor(i / cells) * px}
            width={px}
            height={px}
            fill="#0F172A"
          />
        ) : null,
      )}
    </svg>
  )
}

/**
 * §5–§8 — the code rotates every 30 seconds so a screenshot in the group chat
 * goes stale, while the previous code keeps working for about another minute so
 * nobody is cut off mid-scan. The six-digit code and the short link are not
 * extras: half the students watch from the phone they would have to scan with.
 */
export function QrPanel({ session }: { session: AttendanceSession }) {
  const rotate = useDataStore((s) => s.rotateAttendanceCode)
  const [left, setLeft] = useState(ROTATE_SECONDS)
  const [fullscreen, setFullscreen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Rotation is a live behaviour, so it runs on real seconds — unlike every
  // other clock in the prototype, which follows the time panel.
  useEffect(() => {
    const timer = setInterval(() => {
      setLeft((prev) => {
        if (prev <= 1) {
          rotate(session.lessonId)
          return ROTATE_SECONDS
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [rotate, session.lessonId])

  const link = `asmr.weglobal.ai/a/${session.code}`

  return (
    <>
      <div className="flex flex-col items-center gap-3">
        <QrArt seed={`${session.lessonId}-${session.code}`} size={168} />

        <div className="text-center">
          <div className="font-mono text-2xl font-bold tracking-widest text-slate-900">
            {session.code.slice(0, 3)} {session.code.slice(3)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Обновится через {left} с · код №{session.tick}
          </div>
          {session.previousCode ? (
            <div className="mt-0.5 text-xs text-slate-400">
              Прошлый код {session.previousCode} ещё действует
            </div>
          ) : null}
        </div>

        <div className="w-full rounded-card bg-page px-3 py-2 text-center text-sm text-slate-700">
          {link}
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="secondary" onClick={() => setFullscreen(true)}>
            Показать на весь экран
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              navigator.clipboard?.writeText(`https://${link}`)
              setCopied(true)
            }}
          >
            {copied ? 'Скопировано' : 'Скопировать ссылку'}
          </Button>
        </div>

        <p className="text-center text-xs text-slate-500">
          Три способа отметиться: скан с ноутбука, ввод кода с телефона или переход
          по ссылке.
        </p>
      </div>

      <Modal open={fullscreen} title="Код для отметки" onClose={() => setFullscreen(false)}>
        <div className="flex flex-col items-center gap-4 py-2">
          <QrArt seed={`${session.lessonId}-${session.code}`} size={280} />
          <div className="font-mono text-4xl font-bold tracking-widest text-slate-900">
            {session.code.slice(0, 3)} {session.code.slice(3)}
          </div>
          <div className="text-base text-slate-700">{link}</div>
          <div className="text-xs text-slate-500">Обновится через {left} с</div>
        </div>
      </Modal>
    </>
  )
}
