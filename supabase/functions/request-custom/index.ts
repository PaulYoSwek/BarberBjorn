import { json, servePost } from '../_shared/http.ts'

/**
 * Clients used to ask for a time outside the agenda here. That is Bjorn's to
 * arrange from the dashboard now, so the site no longer offers it and this
 * endpoint turns every request away. It stays deployed so an old tab gets a
 * clear answer instead of a crash.
 */
servePost((req) => Promise.resolve(json(req, 410, { ok: false, error: 'gone' })))
