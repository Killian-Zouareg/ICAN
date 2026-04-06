/**
 * Extrait les IDs des lieux mentionnés dans le contenu d'un post.
 * Cherche les patterns <NomDuLieu> et les résout en UUIDs via la liste des locations.
 */
export function extractLocationIds(content, locations) {
  if (!content || !locations?.length) return []
  const matches = [...content.matchAll(/<([^>]+)>/g)]
  const ids = []
  for (const m of matches) {
    const name = m[1].trim()
    const loc = locations.find(l => l.name.toLowerCase() === name.toLowerCase())
    if (loc) ids.push(loc.id)
  }
  return [...new Set(ids)]
}
