/** Включает нативный HMAC для расчёта раундов. Импортируется на входе
 *  в процесс — и сервером, и тестами. */
import { createHmac } from 'node:crypto'
import { useFastHmac } from './core/games.js'

useFastHmac((key, msg) => createHmac('sha256', key).update(msg, 'utf8').digest('hex'))
