import { Route } from '../App'
import { BalancePill, Header } from '../components/ui'
import { levelFromXp, titleFor } from '../core/economy'
import { CASES } from '../core/cases'
import { useGame } from '../store/game'
import { sfx } from '../lib/fx'

export interface G { r: Route['s']; t: string; s: string; ico: string; tint: string }

export const GAMES: G[] = [
  { r: 'upgrade', t: 'Апгрейд', s: 'x1.05 — x50', ico: '🎰', tint: '#A855F7' },
  { r: 'cases', t: 'Кейсы', s: `${CASES.length} кейсов`, ico: '📦', tint: '#F0468C' },
  { r: 'mines', t: 'Мины', s: 'поле 5×5', ico: '💣', tint: '#3DD68C' },
  { r: 'crash', t: 'Краш', s: 'успей забрать', ico: '🚀', tint: '#FF9A2E' },
  { r: 'contract', t: 'Контракт', s: '3–10 предметов', ico: '📝', tint: '#7C5CFF' },
  { r: 'battle', t: 'Битва кейсов', s: 'против ботов', ico: '⚔️', tint: '#3B82F6' },
  { r: 'double', t: 'Дабл', s: 'x2 и x14', ico: '🔴', tint: '#FF4D4D' },
  { r: 'dice', t: 'Кости', s: 'больше / меньше', ico: '🎲', tint: '#00D3C7' },
  { r: 'tower', t: 'Башня', s: '8 этажей вверх', ico: '🗼', tint: '#8B6BFF' },
  { r: 'slots', t: 'Слоты', s: 'три семёрки', ico: '🎰', tint: '#FFC53D' },
  { r: 'jackpot', t: 'Джекпот', s: 'банк забирает один', ico: '🏦', tint: '#A3E635' },
]

/** Цвет плитки раскладывается в подсветку, свечение и цвет рамки при нажатии. */
export function tintVars(c: string): React.CSSProperties {
  return {
    ['--tint' as any]: `color-mix(in srgb, ${c} 26%, transparent)`,
    ['--tint-glow' as any]: `color-mix(in srgb, ${c} 55%, transparent)`,
    ['--tint-line' as any]: `color-mix(in srgb, ${c} 60%, transparent)`,
  }
}

export default function Games({ go }: { go: (r: Route) => void }) {
  const xp = useGame((s) => s.xp)
  const lvl = levelFromXp(xp)

  return (
    <>
      <Header title="Игры" sub={`${titleFor(lvl.lvl)} · ур. ${lvl.lvl}`} right={<BalancePill />} />
      <div className="screen">
        <div className="pad">
          <div className="grid2">
            {GAMES.map((x) => (
              <button
                key={x.r}
                className="gcard"
                style={tintVars(x.tint)}
                onClick={() => { sfx.click(); go({ s: x.r } as Route) }}
              >
                <span className="gico">{x.ico}</span>
                <span className="gt">{x.t}</span>
                <span className="gs">{x.s}</span>
              </button>
            ))}
          </div>

        </div>
      </div>
    </>
  )
}
