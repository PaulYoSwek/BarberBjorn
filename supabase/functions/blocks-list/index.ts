import { dateIso } from '../../../src/schedule.ts'
import { serviceClient } from '../_shared/db.ts'
import { json, rejectUnlessSession, servePost } from '../_shared/http.ts'
import { salonNow } from '../_shared/salon.ts'

const PAGE = 1000

type Row = { date: string; time: string | null; reason: string | null; color: string | null }

/** Closed times with their reason and colour, for the dashboard only. */
servePost(async (req) => {
  const denied = await rejectUnlessSession(req)
  if (denied) return denied
  const db = serviceClient()
  const yesterday = new Date(salonNow())
  yesterday.setDate(yesterday.getDate() - 1)
  const from = dateIso(yesterday)
  const blocks: { date: string; time?: string; reason: string; color: string }[] = []
  for (let page = 0; ; page++) {
    const { data, error } = await db
      .from('schedule_blocks')
      .select('date, time, reason, color')
      .gte('date', from)
      .order('date')
      .order('time')
      .range(page * PAGE, page * PAGE + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Row[]
    for (const row of rows) {
      blocks.push({
        date: String(row.date).slice(0, 10),
        ...(row.time ? { time: row.time.slice(0, 5) } : {}),
        reason: row.reason ?? '',
        color: row.color ?? '',
      })
    }
    if (rows.length < PAGE) break
  }
  return json(req, 200, { ok: true, blocks })
})
