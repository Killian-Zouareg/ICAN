import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'
import { checkRateLimit } from '../lib/rateLimit'
import { compressImage } from '../lib/imageCompress'

const PAGE_SIZE = 50

export const usePostsStore = defineStore('posts', () => {
  const posts = ref([])
  const loading = ref(false)
  const loadingOlder = ref(false)
  const hasMorePosts = ref(false)
  const userLikes = ref(new Set())
  const userReposts = ref(new Set()) // IDs of original posts the user has reposted

  // Tracks the current feed context so loadOlderPosts knows which query to extend
  // { type: 'feed' } | { type: 'user', profileId }
  let currentFeedContext = null

  async function fetchFeed() {
    loading.value = true
    currentFeedContext = { type: 'feed' }
    try {
      const { data, error } = await supabase
        .from('posts_with_stats')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE + 1)
      if (!error) {
        const rows = data || []
        hasMorePosts.value = rows.length > PAGE_SIZE
        const trimmed = hasMorePosts.value ? rows.slice(0, PAGE_SIZE) : rows
        let enriched = await enrichReposts(trimmed)
        enriched = await enrichAuthorStatus(enriched)
        posts.value = enriched
        await fetchUserLikes()
        await fetchUserReposts()
      }
    } finally {
      loading.value = false
    }
  }

  async function fetchUserPosts(profileId) {
    loading.value = true
    currentFeedContext = { type: 'user', profileId }
    try {
      const { data, error } = await supabase
        .from('posts_with_stats')
        .select('*')
        .eq('author_id', profileId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE + 1)
      if (!error) {
        const rows = data || []
        hasMorePosts.value = rows.length > PAGE_SIZE
        const trimmed = hasMorePosts.value ? rows.slice(0, PAGE_SIZE) : rows
        let enriched = await enrichReposts(trimmed)
        enriched = await enrichAuthorStatus(enriched)
        posts.value = enriched
        await fetchUserLikes()
        await fetchUserReposts()
      }
    } finally {
      loading.value = false
    }
  }

  async function loadOlderPosts() {
    if (loadingOlder.value || !hasMorePosts.value || !currentFeedContext) return
    if (posts.value.length === 0) return
    const oldest = posts.value[posts.value.length - 1]
    if (!oldest?.created_at) return
    loadingOlder.value = true
    try {
      let query = supabase
        .from('posts_with_stats')
        .select('*')
        .lt('created_at', oldest.created_at)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE + 1)
      if (currentFeedContext.type === 'user') {
        query = query.eq('author_id', currentFeedContext.profileId)
      }
      const { data, error } = await query
      if (error) return
      const rows = data || []
      hasMorePosts.value = rows.length > PAGE_SIZE
      const trimmed = hasMorePosts.value ? rows.slice(0, PAGE_SIZE) : rows
      let enriched = await enrichReposts(trimmed)
      enriched = await enrichAuthorStatus(enriched)
      // Dédup au cas où (race condition realtime)
      const existing = new Set(posts.value.map((p) => p.id))
      const fresh = enriched.filter((p) => !existing.has(p.id))
      posts.value = [...posts.value, ...fresh]
      // Étend les sets de likes/reposts pour les nouveaux posts
      await extendUserLikes(fresh.map((p) => p.id))
    } finally {
      loadingOlder.value = false
    }
  }

  async function extendUserLikes(postIds) {
    const auth = useAuthStore()
    if (!auth.activeProfile || postIds.length === 0) return
    const { data } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', auth.activeProfile.id)
      .in('post_id', postIds)
    ;(data || []).forEach((l) => userLikes.value.add(l.post_id))
  }

  // Fetch is_admin flag for all authors and attach it to posts
  async function enrichAuthorStatus(postsList) {
    const authorIds = [...new Set(postsList.map((p) => p.author_id).filter(Boolean))]
    if (authorIds.length === 0) return postsList

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, is_admin, is_hero, hero_color_primary, hero_color_secondary')
      .in('id', authorIds)

    const authorMap = {}
    ;(profiles || []).forEach((p) => {
      authorMap[p.id] = p
    })

    return postsList.map((p) => ({
      ...p,
      is_admin: authorMap[p.author_id]?.is_admin || false,
      is_hero: authorMap[p.author_id]?.is_hero || false,
      hero_color_primary: authorMap[p.author_id]?.hero_color_primary || null,
      hero_color_secondary: authorMap[p.author_id]?.hero_color_secondary || null,
    }))
  }

  // Fetch original posts for any reposts/quotes in the list
  async function enrichReposts(postsList) {
    const repostIds = postsList.filter((p) => p.repost_of).map((p) => p.repost_of)
    const quoteIds = postsList.filter((p) => p.quote_of).map((p) => p.quote_of)
    const quoteCommentIds = postsList.filter((p) => p.quote_comment_id).map((p) => p.quote_comment_id)

    const allPostIds = [...new Set([...repostIds, ...quoteIds])]

    let originalsMap = {}
    if (allPostIds.length > 0) {
      const { data: originals } = await supabase
        .from('posts_with_stats')
        .select('*')
        .in('id', allPostIds)

      const originalAuthorIds = [...new Set((originals || []).map((p) => p.author_id).filter(Boolean))]
      let authorMap = {}
      if (originalAuthorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, is_admin, is_hero, hero_color_primary, hero_color_secondary')
          .in('id', originalAuthorIds)
        ;(profiles || []).forEach((p) => {
          authorMap[p.id] = p
        })
      }
      ;(originals || []).forEach((p) => {
        originalsMap[p.id] = {
          ...p,
          is_admin: authorMap[p.author_id]?.is_admin || false,
          is_hero: authorMap[p.author_id]?.is_hero || false,
          hero_color_primary: authorMap[p.author_id]?.hero_color_primary || null,
          hero_color_secondary: authorMap[p.author_id]?.hero_color_secondary || null,
        }
      })
    }

    let quotedCommentsMap = {}
    if (quoteCommentIds.length > 0) {
      const uniqueCommentIds = [...new Set(quoteCommentIds)]
      const { data: quotedComments } = await supabase
        .from('comments')
        .select('*, profiles(username, display_name, avatar_url, is_hero, hero_color_primary, hero_color_secondary)')
        .in('id', uniqueCommentIds)
      ;(quotedComments || []).forEach((c) => {
        quotedCommentsMap[c.id] = c
      })
    }

    return postsList.map((p) => {
      let enriched = { ...p }
      if (p.repost_of && originalsMap[p.repost_of]) {
        enriched._original = originalsMap[p.repost_of]
      }
      if (p.quote_of && originalsMap[p.quote_of]) {
        enriched._quoted = originalsMap[p.quote_of]
      }
      if (p.quote_comment_id && quotedCommentsMap[p.quote_comment_id]) {
        enriched._quoted_comment = quotedCommentsMap[p.quote_comment_id]
      }
      return enriched
    })
  }

  async function fetchUserLikes() {
    const auth = useAuthStore()
    if (!auth.activeProfile) return
    const postIds = posts.value.map((p) => p.id)
    if (postIds.length === 0) return
    const { data } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', auth.activeProfile.id)
      .in('post_id', postIds)
    userLikes.value = new Set((data || []).map((l) => l.post_id))
  }

  async function fetchUserReposts() {
    const auth = useAuthStore()
    if (!auth.activeProfile) return
    const { data } = await supabase
      .from('posts')
      .select('repost_of')
      .eq('author_id', auth.activeProfile.id)
      .not('repost_of', 'is', null)
    userReposts.value = new Set((data || []).map((r) => r.repost_of))
  }

  async function createPost(content, imageFile = null, locationIds = [], liveShareId = null) {
    const auth = useAuthStore()
    await auth.checkBan()
    const rateLimitMsg = checkRateLimit('post')
    if (rateLimitMsg) throw new Error(rateLimitMsg)
    if (content && content.length > 2000) throw new Error('Le post ne doit pas dépasser 2000 caractères')
    if (!content?.trim() && !imageFile) throw new Error('Le post ne peut pas être vide')
    let imageUrl = null

    // Upload image if provided
    if (imageFile) {
      const uploadLimit = checkRateLimit('upload')
      if (uploadLimit) throw new Error(uploadLimit)

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(imageFile.type)) {
        throw new Error('Type de fichier non autoris\u00e9. Utilise JPG, PNG, GIF ou WebP.')
      }
      // Validate file size (5 MB)
      if (imageFile.size > 5 * 1024 * 1024) {
        throw new Error('Image trop lourde (max 5 Mo)')
      }

      const compressed = await compressImage(imageFile)
      const ext = (compressed.name || imageFile.name).split('.').pop()
      const fileName = `${auth.activeProfile.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(fileName, compressed)
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage
        .from('post-images')
        .getPublicUrl(fileName)
      imageUrl = urlData.publicUrl
    }

    const insertData = {
      author_id: auth.activeProfile.id,
      content,
    }
    if (imageUrl) {
      insertData.image_url = imageUrl
    }
    if (locationIds.length > 0) {
      insertData.location_ids = locationIds
    }
    if (liveShareId) {
      insertData.live_share_id = liveShareId
    }

    const { data: inserted, error } = await supabase
      .from('posts')
      .insert(insertData)
      .select('id')
      .single()
    if (error) throw error
    if (liveShareId && inserted?.id) {
      // Link share back to post for FK cascade
      await supabase
        .from('live_location_shares')
        .update({ post_id: inserted.id })
        .eq('id', liveShareId)
    }
    await fetchFeed()
  }

  async function deletePost(postId) {
    const { error } = await supabase.from('posts').delete().eq('id', postId)
    if (error) throw error
    posts.value = posts.value.filter((p) => p.id !== postId)
  }

  async function toggleLike(postId) {
    const auth = useAuthStore()
    await auth.checkBan()
    const rateLimitMsg = checkRateLimit('like')
    if (rateLimitMsg) throw new Error(rateLimitMsg)
    const profileId = auth.activeProfile.id
    if (userLikes.value.has(postId)) {
      await supabase
        .from('likes')
        .delete()
        .eq('user_id', profileId)
        .eq('post_id', postId)
      userLikes.value.delete(postId)
      const post = posts.value.find((p) => p.id === postId)
      if (post) post.like_count--
    } else {
      await supabase.from('likes').insert({
        user_id: profileId,
        post_id: postId,
      })
      userLikes.value.add(postId)
      const post = posts.value.find((p) => p.id === postId)
      if (post) post.like_count++
    }
  }

  async function toggleRepost(originalPostId) {
    const auth = useAuthStore()
    await auth.checkBan()
    const rateLimitMsg = checkRateLimit('repost')
    if (rateLimitMsg) throw new Error(rateLimitMsg)
    const profileId = auth.activeProfile.id

    if (userReposts.value.has(originalPostId)) {
      // Undo repost: delete the repost post
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('author_id', profileId)
        .eq('repost_of', originalPostId)
      if (error) throw error
      userReposts.value.delete(originalPostId)
      // Update repost count on the original post in the list
      posts.value.forEach((p) => {
        if (p.id === originalPostId) p.repost_count--
        if (p._original && p._original.id === originalPostId) p._original.repost_count--
      })
      // Remove the repost from the feed
      posts.value = posts.value.filter(
        (p) => !(p.repost_of === originalPostId && p.author_id === profileId)
      )
    } else {
      // Create repost
      const { error } = await supabase.from('posts').insert({
        author_id: profileId,
        content: '',
        repost_of: originalPostId,
      })
      if (error) throw error
      userReposts.value.add(originalPostId)
      // Update repost count locally
      posts.value.forEach((p) => {
        if (p.id === originalPostId) p.repost_count++
        if (p._original && p._original.id === originalPostId) p._original.repost_count++
      })
      // Refresh to get the new repost in feed
      await fetchFeed()
    }
  }

  function hasReposted(originalPostId) {
    return userReposts.value.has(originalPostId)
  }

  // =========================================
  // Comments
  // =========================================

  async function fetchComments(postId) {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(username, display_name, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    const comments = data || []
    if (comments.length > 0) {
      const commentIds = comments.map((c) => c.id)
      const { data: likeCounts } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .in('comment_id', commentIds)

      const likeMap = {}
      ;(likeCounts || []).forEach((l) => {
        likeMap[l.comment_id] = (likeMap[l.comment_id] || 0) + 1
      })
      comments.forEach((c) => {
        c.like_count = likeMap[c.id] || 0
      })
    }

    return comments
  }

  async function fetchCommentLikes(commentIds) {
    const auth = useAuthStore()
    if (!auth.activeProfile || commentIds.length === 0) return new Set()
    const { data } = await supabase
      .from('comment_likes')
      .select('comment_id')
      .eq('user_id', auth.activeProfile.id)
      .in('comment_id', commentIds)
    return new Set((data || []).map((l) => l.comment_id))
  }

  async function toggleCommentLike(commentId) {
    const auth = useAuthStore()
    const profileId = auth.activeProfile.id
    const { data: existing } = await supabase
      .from('comment_likes')
      .select('id')
      .eq('user_id', profileId)
      .eq('comment_id', commentId)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('comment_likes')
        .delete()
        .eq('user_id', profileId)
        .eq('comment_id', commentId)
      return false
    } else {
      await supabase.from('comment_likes').insert({
        user_id: profileId,
        comment_id: commentId,
      })
      return true
    }
  }

  async function addComment(postId, content, parentId = null, imageFile = null) {
    const auth = useAuthStore()
    await auth.checkBan()
    const rateLimitMsg = checkRateLimit('comment')
    if (rateLimitMsg) throw new Error(rateLimitMsg)
    if (!content?.trim() && !imageFile) throw new Error('Le commentaire ne peut pas être vide')
    if (content && content.length > 1000) throw new Error('Le commentaire ne doit pas dépasser 1000 caractères')

    let imageUrl = null
    if (imageFile) {
      const uploadLimit = checkRateLimit('upload')
      if (uploadLimit) throw new Error(uploadLimit)

      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(imageFile.type)) {
        throw new Error('Type de fichier non autorisé. Utilise JPG, PNG, GIF ou WebP.')
      }
      if (imageFile.size > 5 * 1024 * 1024) {
        throw new Error('Image trop lourde (max 5 Mo)')
      }

      const compressed = await compressImage(imageFile)
      const ext = (compressed.name || imageFile.name).split('.').pop()
      const fileName = `${auth.activeProfile.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('comment-images')
        .upload(fileName, compressed)
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage
        .from('comment-images')
        .getPublicUrl(fileName)
      imageUrl = urlData.publicUrl
    }

    const insertData = {
      author_id: auth.activeProfile.id,
      post_id: postId,
      content: content || '',
    }
    if (parentId) {
      insertData.parent_id = parentId
    }
    if (imageUrl) {
      insertData.image_url = imageUrl
    }
    const { error } = await supabase.from('comments').insert(insertData)
    if (error) throw error
  }

  async function deleteComment(commentId) {
    const { error } = await supabase.from('comments').delete().eq('id', commentId)
    if (error) throw error
  }

  async function createQuotePost(content, quoteOfId, quoteCommentId, imageFile = null, locationIds = []) {
    const auth = useAuthStore()
    await auth.checkBan()
    const rateLimitMsg = checkRateLimit('post')
    if (rateLimitMsg) throw new Error(rateLimitMsg)
    if (!content?.trim() && !imageFile) throw new Error('Le post ne peut pas être vide')
    if (content && content.length > 2000) throw new Error('Le post ne doit pas dépasser 2000 caractères')

    let imageUrl = null
    if (imageFile) {
      const uploadLimit = checkRateLimit('upload')
      if (uploadLimit) throw new Error(uploadLimit)
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(imageFile.type)) {
        throw new Error('Type de fichier non autorisé. Utilise JPG, PNG, GIF ou WebP.')
      }
      if (imageFile.size > 5 * 1024 * 1024) {
        throw new Error('Image trop lourde (max 5 Mo)')
      }
      const compressed = await compressImage(imageFile)
      const ext = (compressed.name || imageFile.name).split('.').pop()
      const fileName = `${auth.activeProfile.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(fileName, compressed)
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage
        .from('post-images')
        .getPublicUrl(fileName)
      imageUrl = urlData.publicUrl
    }

    const insertData = {
      author_id: auth.activeProfile.id,
      content: content || '',
    }
    if (quoteOfId) insertData.quote_of = quoteOfId
    if (quoteCommentId) insertData.quote_comment_id = quoteCommentId
    if (imageUrl) insertData.image_url = imageUrl
    if (locationIds.length > 0) insertData.location_ids = locationIds

    const { error } = await supabase.from('posts').insert(insertData)
    if (error) throw error
    await fetchFeed()
  }

  function hasLiked(postId) {
    return userLikes.value.has(postId)
  }

  // Realtime: pending new posts (not yet shown in feed)
  const newPostIds = ref([])

  function addPendingPost(postId) {
    if (!posts.value.find(p => p.id === postId) && !newPostIds.value.includes(postId)) {
      newPostIds.value.push(postId)
    }
  }

  async function loadNewPosts() {
    await fetchFeed()
    newPostIds.value = []
  }

  return {
    posts,
    loading,
    loadingOlder,
    hasMorePosts,
    userLikes,
    userReposts,
    newPostIds,
    fetchFeed,
    fetchUserPosts,
    loadOlderPosts,
    createPost,
    deletePost,
    toggleLike,
    toggleRepost,
    hasReposted,
    fetchComments,
    fetchCommentLikes,
    toggleCommentLike,
    addComment,
    deleteComment,
    hasLiked,
    createQuotePost,
    addPendingPost,
    loadNewPosts,
  }
})
