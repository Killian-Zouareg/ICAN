/**
 * Échappe les caractères HTML pour éviter les injections XSS
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Transforme le contenu texte en HTML avec les @mentions comme liens cliquables.
 * Utilise le hash router (#/user/...) pour la navigation SPA.
 */
export function renderMentions(text) {
  if (!text) return ''
  const escaped = escapeHtml(text)
  let result = escaped.replace(/@([a-zA-Z0-9_]+)/g, '<a href="#/user/$1" class="mention">@$1</a>')
  result = result.replace(/&lt;([^&]+?)&gt;/g, '<a href="#/map?location=$1" class="location-mention">\u{1F4CD} $1</a>')
  return result
}
