import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'

export const usePostsStore = defineStore('posts', () => {
  const posts = ref([])
  const loading = ref(false)
  const userLikes = ref(new Set())

  async function fetchFeed() {
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('posts_with_stats')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (!error) {
        posts.value = data || []
        await fetchUserLikes()
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
        posts.value = data || []
        await fetchUserLikes()
      }
    } finally {
      loading.value = false
    }
  }

  async function fetchUserLikes() {
    const auth = useAuthStore()
    if (!auth.activeProfile) return
    const postIds = posts.value.map((p) => p.id)
    if (postIds.length === 0) return
    const profileIds = auth.profiles.map((p) => p.id)
    const { data } = await supabase
      .from('likes')
      .select('post_id')
      .in('user_id', profileIds)
      .in('post_id', postIds)
    userLikes.value = new Set((data || []).map((l) => l.post_id))
  }

  async function createPost(content) {
    const auth = useAuthStore()
    const { error } = await supabase.from('posts').insert({
      author_id: auth.activeProfile.id,
      content,
    })
    if (error) throw error
    await fetchFeed()
  }

  async function deletePost(postId) {
    const { error } = await supabase.from('posts').delete().eq('id', postId)
    if (error) throw error
    posts.value = posts.value.filter((p) => p.id !== postId)
  }

  async function toggleLike(postId) {
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

  async function repost(postId) {
    const auth = useAuthStore()
    const { error } = await supabase.from('posts').insert({
      author_id: auth.activeProfile.id,
      content: '',
      repost_of: postId,
    })
    if (error) throw error
    await fetchFeed()
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

    // Fetch like counts for all comments
    const comments = data || []
    if (comments.length > 0) {
      const commentIds = comments.map((c) => c.id)
      const { data: likeCounts } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .in('comment_id', commentIds)

      // Count likes per comment
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
    const profileIds = auth.profiles.map((p) => p.id)
    const { data } = await supabase
      .from('comment_likes')
      .select('comment_id')
      .in('user_id', profileIds)
      .in('comment_id', commentIds)
    return new Set((data || []).map((l) => l.comment_id))
  }

  async function toggleCommentLike(commentId) {
    const auth = useAuthStore()
    const profileId = auth.activeProfile.id
    // Check if already liked
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
      return false // unliked
    } else {
      await supabase.from('comment_likes').insert({
        user_id: profileId,
        comment_id: commentId,
      })
      return true // liked
    }
  }

  async function addComment(postId, content, parentId = null) {
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
    fetchFeed,
    fetchUserPosts,
    createPost,
    deletePost,
    toggleLike,
    repost,
    fetchComments,
    fetchCommentLikes,
    toggleCommentLike,
    addComment,
    deleteComment,
    hasLiked,
  }
})
