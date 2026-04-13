function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Render wiki content: escapes HTML, converts [[Article Name]] to links,
 * and preserves line breaks.
 * @param {string} text - Raw text content
 * @param {Array} articles - Array of { title, slug } from wikiArticles store
 * @returns {string} HTML string safe for v-html
 */
export function renderWikiContent(text, articles = []) {
  if (!text) return ''
  let html = escapeHtml(text)

  // Replace [[Article Name]] with links
  html = html.replace(/\[\[([^\]]+)\]\]/g, (match, name) => {
    const trimmed = name.trim()
    const article = articles.find(a => a.title.toLowerCase() === trimmed.toLowerCase())
    if (article) {
      return `<a href="#/wiki/article/${encodeURIComponent(article.slug)}" class="wiki-link">${escapeHtml(trimmed)}</a>`
    }
    return `<span class="wiki-link-missing">${escapeHtml(trimmed)}</span>`
  })

  // Preserve line breaks
  html = html.replace(/\n/g, '<br>')

  return html
}
