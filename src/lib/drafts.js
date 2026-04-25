const STORAGE_KEY = 'ican_post_drafts_v1'

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeAll(all) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

function keyFor(profileId) {
  return profileId || 'anon'
}

export function listDrafts(profileId) {
  const all = readAll()
  const list = all[keyFor(profileId)] || []
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function saveDraft(profileId, { id, name, content, image }) {
  if (!content?.trim() && !name?.trim() && !image) return null
  const all = readAll()
  const k = keyFor(profileId)
  const list = all[k] || []
  const now = Date.now()
  if (id) {
    const idx = list.findIndex((d) => d.id === id)
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        name: name ?? list[idx].name,
        content,
        image: image !== undefined ? image : list[idx].image,
        updatedAt: now,
      }
      all[k] = list
      writeAll(all)
      return list[idx]
    }
  }
  const draft = {
    id: `${now}_${Math.random().toString(36).slice(2, 8)}`,
    name: (name || '').trim(),
    content,
    image: image || null,
    createdAt: now,
    updatedAt: now,
  }
  list.push(draft)
  all[k] = list
  writeAll(all)
  return draft
}

export function deleteDraft(profileId, id) {
  const all = readAll()
  const k = keyFor(profileId)
  const list = all[k] || []
  all[k] = list.filter((d) => d.id !== id)
  writeAll(all)
}

export function renameDraft(profileId, id, name) {
  const all = readAll()
  const k = keyFor(profileId)
  const list = all[k] || []
  const idx = list.findIndex((d) => d.id === id)
  if (idx >= 0) {
    list[idx] = { ...list[idx], name: (name || '').trim(), updatedAt: Date.now() }
    all[k] = list
    writeAll(all)
  }
}
