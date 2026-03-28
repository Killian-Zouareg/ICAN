/**
 * Simple client-side rate limiter.
 * Prevents spam by tracking timestamps of recent actions.
 */

const actionTimestamps = {}

/**
 * Check if an action is allowed based on rate limits.
 * @param {string} action - Name of the action (e.g. 'post', 'comment', 'message')
 * @param {number} maxActions - Max number of actions allowed in the window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} true if allowed, false if rate limited
 */
export function isRateLimited(action, maxActions, windowMs) {
  const now = Date.now()
  if (!actionTimestamps[action]) {
    actionTimestamps[action] = []
  }

  // Remove old timestamps outside the window
  actionTimestamps[action] = actionTimestamps[action].filter(
    (t) => now - t < windowMs
  )

  if (actionTimestamps[action].length >= maxActions) {
    return true // rate limited
  }

  actionTimestamps[action].push(now)
  return false
}

/**
 * Pre-configured rate limits for different actions.
 * Returns error message in French if rate limited, null if allowed.
 */
export function checkRateLimit(action) {
  const limits = {
    post: { max: 5, window: 60000, msg: 'Trop de posts. Attends un peu avant de reposter.' },
    comment: { max: 10, window: 60000, msg: 'Trop de commentaires. Attends un peu.' },
    message: { max: 20, window: 60000, msg: 'Trop de messages. Attends un peu.' },
    like: { max: 30, window: 60000, msg: 'Trop de likes. Attends un peu.' },
    repost: { max: 10, window: 60000, msg: 'Trop de reposts. Attends un peu.' },
    upload: { max: 5, window: 120000, msg: 'Trop d\'uploads. Attends 2 minutes.' },
  }

  const limit = limits[action]
  if (!limit) return null

  if (isRateLimited(action, limit.max, limit.window)) {
    return limit.msg
  }
  return null
}
