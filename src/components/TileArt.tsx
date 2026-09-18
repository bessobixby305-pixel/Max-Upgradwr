import { useState } from 'react'

/** Иллюстрация плитки. Пока картинки нет — остаётся эмодзи, ничего не ломается. */
export default function TileArt({ art, emo }: { art?: string; emo: string }) {
  const [failed, setFailed] = useState(false)
  if (!art || failed) return <span className="gico">{emo}</span>
  return (
    <img
      className="gico-full"
      src={`./art/${art}.webp`}
      alt=""
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
    />
  )
}
