import { useEffect, useState } from 'react'
import { pretty, toAccelerator } from './accelerator.js'

interface Props {
  value: string
  onChange: (accelerator: string) => Promise<string | null>
}

export function ShortcutRecorder({ value, onChange }: Props): React.JSX.Element {
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!capturing) return

    const onKeyDown = (e: KeyboardEvent): void => {
      e.preventDefault()
      if (e.key === 'Escape') {
        setCapturing(false)
        return
      }
      const accelerator = toAccelerator(e)
      if (!accelerator) return
      setCapturing(false)
      void onChange(accelerator).then(setError)
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [capturing, onChange])

  return (
    <div className="shortcut-wrap">
      <button
        className={`shortcut ${capturing ? 'capturing' : ''}`}
        onClick={() => {
          setError(null)
          setCapturing((c) => !c)
        }}
      >
        {capturing ? 'Nacisnij klawisze…' : pretty(value)}
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  )
}
