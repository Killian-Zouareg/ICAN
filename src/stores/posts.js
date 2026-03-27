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
    const { data, error } = await supabase
      .from('posts_with_stats')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (!error) {
      posts.value = data || []
      await fetchUserLikes()
    }
    loading.value = false
  }

  async function fetchUserPosts(userId) {
    loading.value = true
    const { data, error } = await supabase
      .from('posts_with_stats')
      .select('*')
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
    if (!error) {
      posts.value = data || []
      await fetchUserLikes()
    }
    loading.value = false
  }

  async function fetchUserLikes() {
    const auth = useAuthStore()
    if (!auth.user) return
    const postIds = posts.value.map((p) => p.id)
    if (postIds.length === 0) return
    const { data } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', auth.user.id)
      .in('post_id', postIds)
    userLikes.value = new Set((data || []).map((l) => l.post_id))
  }

  async function createPost(content) {
    const auth = useAuthStore()
    const { error } = await supabase.from('posts').insert({
      author_id: auth.user.id,
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
    if (userLikes.value.has(postId)) {
      await supabase
        .from('likes')
        .delete()
        .eq('user_id', auth.user.id)
        .eq('post_id', postId)
      userLikes.value.delete(postId)
      const post = posts.value.find((p) => p.id === postId)
      if (post) post.like_count--
    } else {
      await supabase.from('likes').insert({
        user_id: auth.user.id,
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
      author_id: auth.user.id,
      content: '',
      repost_of: postId,
    })
    if (error) throw error
    await fetchFeed()
  }

  async function fetchComments(postId) {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(username, display_name, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    return data || []
  }

  async function addComment(postId, content) {
    const auth = useAuthStore()
    const { error } = await supabase.from('comments').insert({
      author_id: auth.user.id,
      post_id: postId,
      content,
    })
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
    addComment,
    deleteComment,
    hasLiked,
  }
})
