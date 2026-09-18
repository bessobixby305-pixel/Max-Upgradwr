import { CASES, pickDrop } from '../core/cases'
import { ITEM_BY_ID } from '../core/items'
import { useGame } from '../store/game'

const NAMES = [
  'Артём', 'Лиза', 'Данил', 'Ника', 'Егор', 'Соня', 'Миша', 'Влад', 'Катя', 'Тимур',
  'Алина', 'Рома', 'Юля', 'Кирилл', 'Настя', 'Паша', 'Маша', 'Саня', 'Вика', 'Денис',
  'Гоша', 'Полина', 'Лёха', 'Дима', 'Оля', 'Стас', 'Ира', 'Женя', 'Борис', 'Аня',
]
const SUFFIX = ['', '', '', '_max', '228', '_чат', 'XD', '2010', '_pro', 'ЪУЪ', '_off']
const EMO = ['🐱', '🐼', '🦊', '🐸', '🐧', '🦄', '🐙', '🦈', '🐝', '🍕', '👾', '🎧', '🌞', '🍀']

const rnd = <T,>(a: T[]) => a[(Math.random() * a.length) | 0]

function fakeUser() {
  return {
    name: rnd(NAMES) + rnd(SUFFIX),
    emo: rnd(EMO),
  }
}

/** Лента чужих выигрышей в «канале». Чистая декорация, на баланс не влияет. */
function makeDrop() {
  const st = useGame.getState()
  if (!st.settings.showDrops) return

  const kind = Math.random()
  if (kind < 0.55) {
    // кейс
    const c = rnd(CASES.slice(0, 1 + ((Math.random() * CASES.length) | 0)))
    const item = pickDrop(c, Math.random())
    st.pushDrop({
      author: fakeUser(),
      result: {
        kind: 'case',
        title: `Кейс «${c.name}»`,
        bet: c.price,
        payout: item.price,
        itemId: item.id,
      },
    })
  } else if (kind < 0.85) {
    // апгрейд
    const bet = [50, 100, 250, 500, 1000, 2500, 7500][(Math.random() * 7) | 0]
    const mult = +(1.3 + Math.random() * Math.random() * 20).toFixed(2)
    const won = Math.random() < 0.92 / mult
    st.pushDrop({
      author: fakeUser(),
      result: {
        kind: 'upgrade',
        title: `Апгрейд x${mult}`,
        bet,
        payout: won ? Math.round(bet * mult) : 0,
        mult,
        chance: 0.92 / mult,
        itemId: won ? ITEM_BY_ID[nearestId(bet * mult)]?.id : undefined,
      },
    })
  } else {
    // краш
    const at = +(1.2 + Math.random() * Math.random() * 12).toFixed(2)
    const bet = [100, 300, 900, 2000][(Math.random() * 4) | 0]
    st.pushDrop({
      author: fakeUser(),
      result: { kind: 'crash', title: `Краш x${at}`, bet, payout: Math.round(bet * at), mult: at },
    })
  }
}

function nearestId(price: number) {
  let best = 'sticker_cat', d = Infinity
  for (const it of Object.values(ITEM_BY_ID)) {
    const dd = Math.abs(it.price - price)
    if (dd < d) { d = dd; best = it.id }
  }
  return best
}

/** Запускает фоновую ленту. Возвращает функцию остановки. */
export function startDropsFeed() {
  if (useGame.getState().messages.filter((m) => m.chat === 'drops').length < 12) {
    for (let i = 0; i < 12; i++) makeDrop()
  }
  let timer = 0
  const loop = () => {
    timer = window.setTimeout(() => {
      makeDrop()
      loop()
    }, 4000 + Math.random() * 9000)
  }
  loop()
  return () => clearTimeout(timer)
}
