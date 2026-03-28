import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'
import { checkRateLimit } from '../lib/rateLimit'

export const usePostsStore = defineStore('posts', () => {
  const posts = ref([])
  const loading = ref(false)
  const userLikes = ref(new Set())
  const userReposts = ref(new Set()) // IDs of original posts the user has reposted

  async function fetchFeed() {
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('posts_with_stats')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (!error) {
        posts.value = await enrichReposts(data || [])
        await fetchUserLikes()
        await fetchUserReposts()
      }
    } finally {
      loading.value = false
    }
  }

  async function fetchUserPosts(profileId) {
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('posts_with_stats')
        .select('*')
        .eq('author_id', profileId)
        .order('created_at', { ascending: false })
      if (!error) {
        posts.value = await enrichReposts(data || [])
        await fetchUserLikes()
        await fetchUserReposts()
      }
    } finally {
      loading.value = false
    }
  }

  // Fetch original posts for any reposts in the list
  async function enrichReposts(postsList) {
    const repostIds = postsList
      .filter((p) => p.repost_of)
      .map((p) => p.repost_of)

    if (repostIds.length === 0) return postsList

    const uniqueIds = [...new Set(repostIds)]
    const { data: originals } = await supabase
      .from('posts_with_stats')
      .select('*')
      .in('id', uniqueIds)

    const originalsMap = {}
    ;(originals || []).forEach((p) => {
      originalsMap[p.id] = p
    })

    return postsList.map((p) => {
      if (p.repost_of && originalsMap[p.repost_of]) {
        return { ...p, _original: originalsMap[p.repost_of] }
      }
      return p
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

  async function createPost(content, imageFile = null) {
    const rateLimitMsg = checkRateLimit('post')
    if (rateLimitMsg) throw new Error(rateLimitMsg)

    const auth = useAuthStore()
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

      const ext = imageFile.name.split('.').pop()
      const fileName = `${auth.activeProfile.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(fileName, imageFile)
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

    const { error } = await supabase.from('posts').insert(insertData)
    if (error) throw error
    await fetchFeed()
  }

  async function deletePost(postId) {
    const { error } = await supabase.from('posts').delete().eq('id', postId)
    if (error) throw error
    posts.value = posts.value.filter((p) => p.id !== postId)
  }

  async function toggleLike(postId) {
    const rateLimitMsg = checkRateLimit('like')
    if (rateLimitMsg) throw new Error(rateLimitMsg)
    const auth = useAuthStore()
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
    const rateLimitMsg = checkRateLimit('repost')
    if (rateLimitMsg) throw new Error(rateLimitMsg)
    const auth = useAuthStore()
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

  async function addComment(postId, content, parentId = null) {
    const rateLimitMsg = checkRateLimit('comment')
    if (rateLimitMsg) throw new Error(rateLimitMsg)
    const auth = useAuthStore()
    const insertData = {
      author_id: auth.activeProfile.id,
      post_id: postId,
      content,
    }
    if (parentId) {
      insertData.parent_id = parentId
    }
    const { error } = await supabase.from('comments').insert(insertData)
    if (error) throw error
  }

  async function deleteComment(commentId) {
    const { error } = await supabase.from('comments').delete().eq('id', commentId)
    if (error) throw error
  }

  function hasLiked(postId) {
    return userLikes.value.has(postId)
  }

  return {
    posts,
    loading,
    userLikes,
    userReposts,
    fetchFeed,
    fetchUserPosts,
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
  }
})
