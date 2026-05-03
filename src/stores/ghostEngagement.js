import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase'
import { generateFakeName, getRandomPhrase } from '../lib/ghostData'

export const useGhostEngagementStore = defineStore('ghostEngagement', () => {
  // Supprime les ghost_profiles dans `ids` qui ne sont plus référencés
  // par aucun ghost_like ni ghost_comment (batch, sans boucle de count).
  async function pruneOrphanGhostProfiles(ids) {
    if (!ids || ids.length === 0) return
    const uniqueIds = [...new Set(ids)]

    const [{ data: stillLiked }, { data: stillCommented }] = await Promise.all([
      supabase.from('ghost_likes').select('ghost_profile_id').in('ghost_profile_id', uniqueIds),
      supabase.from('ghost_comments').select('ghost_profile_id').in('ghost_profile_id', uniqueIds),
    ])

    const referenced = new Set([
      ...((stillLiked || []).map((r) => r.ghost_profile_id)),
      ...((stillCommented || []).map((r) => r.ghost_profile_id)),
    ])
    const orphans = uniqueIds.filter((id) => !referenced.has(id))
    if (orphans.length > 0) {
      await supabase.from('ghost_profiles').delete().in('id', orphans)
    }
  }

  // Génère N ghost_profiles + ghost_likes pour un post
  async function setGhostLikes(postId, count) {
    // Supprimer les ghost_likes existants (et les ghost_profiles orphelins)
    const { data: existingLikes } = await supabase
      .from('ghost_likes')
      .select('ghost_profile_id')
      .eq('post_id', postId)

    if (existingLikes && existingLikes.length > 0) {
      const ids = existingLikes.map((l) => l.ghost_profile_id)
      await supabase.from('ghost_likes').delete().eq('post_id', postId)
      await pruneOrphanGhostProfiles(ids)
    }

    if (count <= 0) return

    // Batch insert N ghost_profiles puis N ghost_likes (2 requêtes au lieu de 2N).
    const profileRows = Array.from({ length: count }, () => {
      const { displayName, username } = generateFakeName()
      return { display_name: displayName, username }
    })
    const { data: createdProfiles, error: profilesError } = await supabase
      .from('ghost_profiles')
      .insert(profileRows)
      .select('id')
    if (profilesError || !createdProfiles) return

    const likeRows = createdProfiles.map((p) => ({
      post_id: postId,
      ghost_profile_id: p.id,
    }))
    if (likeRows.length > 0) {
      await supabase.from('ghost_likes').insert(likeRows)
    }
  }

  // Met à jour ghost_repost_count sur le post
  async function setGhostReposts(postId, count) {
    await supabase
      .from('posts')
      .update({ ghost_repost_count: Math.max(0, count) })
      .eq('id', postId)
  }

  // Génère N ghost_comments pour un post avec une humeur donnée
  async function setGhostComments(postId, count, mood) {
    // Supprimer les ghost_comments existants
    const { data: existingComments } = await supabase
      .from('ghost_comments')
      .select('ghost_profile_id')
      .eq('post_id', postId)

    if (existingComments && existingComments.length > 0) {
      const ids = existingComments.map((c) => c.ghost_profile_id)
      await supabase.from('ghost_comments').delete().eq('post_id', postId)
      await pruneOrphanGhostProfiles(ids)
    }

    if (count <= 0) return

    // Batch insert N ghost_profiles puis N ghost_comments (2 requêtes au lieu de 2N).
    const profileRows = Array.from({ length: count }, () => {
      const { displayName, username } = generateFakeName()
      return { display_name: displayName, username }
    })
    const { data: createdProfiles, error: profilesError } = await supabase
      .from('ghost_profiles')
      .insert(profileRows)
      .select('id')
    if (profilesError || !createdProfiles) return

    const commentRows = createdProfiles.map((p) => ({
      post_id: postId,
      ghost_profile_id: p.id,
      content: getRandomPhrase(mood),
      mood,
    }))
    if (commentRows.length > 0) {
      await supabase.from('ghost_comments').insert(commentRows)
    }
  }

  // Récupère les ghost likes avec profils pour affichage dans la liste des likes
  async function fetchGhostLikes(postId) {
    const { data } = await supabase
      .from('ghost_likes')
      .select('*, ghost_profiles(id, display_name, username)')
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
    return (data || []).map((l) => ({
      id: l.id,
      display_name: l.ghost_profiles.display_name,
      username: l.ghost_profiles.username,
      avatar_url: null,
      ghost_id: l.ghost_profiles.id,
      isGhost: true,
    }))
  }

  // Récupère les ghost comments avec profils pour affichage
  async function fetchGhostComments(postId) {
    const { data } = await supabase
      .from('ghost_comments')
      .select('*, ghost_profiles(id, display_name, username)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    return (data || []).map((c) => ({
      id: c.id,
      content: c.content,
      mood: c.mood,
      created_at: c.created_at,
      parent_id: null,
      image_url: null,
      like_count: 0,
      ghost_profile_id: c.ghost_profiles.id,
      profiles: {
        username: c.ghost_profiles.username,
        display_name: c.ghost_profiles.display_name,
        avatar_url: null,
      },
      isGhost: true,
    }))
  }

  // Récupère un ghost_profile par son ID
  async function fetchGhostProfile(id) {
    const { data } = await supabase
      .from('ghost_profiles')
      .select('*')
      .eq('id', id)
      .single()
    return data
  }

  // Met à jour les compteurs virtuels (fake) sur le post — aucune ligne créée
  async function setFakeCounts(postId, { fakeLikes, fakeComments, fakeReposts }) {
    const updates = {}
    if (fakeLikes != null) updates.fake_like_count = Math.max(0, fakeLikes)
    if (fakeComments != null) updates.fake_comment_count = Math.max(0, fakeComments)
    if (fakeReposts != null) updates.ghost_repost_count = Math.max(0, fakeReposts)
    if (Object.keys(updates).length > 0) {
      await supabase.from('posts').update(updates).eq('id', postId)
    }
  }

  // Récupère les compteurs actuels de ghost engagement pour un post
  async function fetchGhostCounts(postId) {
    const [{ count: likesCount }, { count: commentsCount }, { data: postData }] = await Promise.all([
      supabase.from('ghost_likes').select('*', { count: 'exact', head: true }).eq('post_id', postId),
      supabase.from('ghost_comments').select('*', { count: 'exact', head: true }).eq('post_id', postId),
      supabase.from('posts').select('ghost_repost_count, fake_like_count, fake_comment_count').eq('id', postId).single(),
    ])
    return {
      likes: likesCount || 0,
      reposts: postData?.ghost_repost_count || 0,
      comments: commentsCount || 0,
      fakeLikes: postData?.fake_like_count || 0,
      fakeComments: postData?.fake_comment_count || 0,
    }
  }

  // Récupère l'humeur actuelle des ghost comments d'un post
  async function fetchGhostCommentsMood(postId) {
    const { data } = await supabase
      .from('ghost_comments')
      .select('mood')
      .eq('post_id', postId)
      .limit(1)
    return data?.[0]?.mood || 'joyeux'
  }

  // Supprime tout l'engagement ghost pour un post
  async function clearGhostEngagement(postId) {
    const { data: likes } = await supabase
      .from('ghost_likes')
      .select('ghost_profile_id')
      .eq('post_id', postId)
    const { data: comments } = await supabase
      .from('ghost_comments')
      .select('ghost_profile_id')
      .eq('post_id', postId)

    await Promise.all([
      supabase.from('ghost_likes').delete().eq('post_id', postId),
      supabase.from('ghost_comments').delete().eq('post_id', postId),
      supabase.from('posts').update({ ghost_repost_count: 0 }).eq('id', postId),
    ])

    // Supprimer les ghost_profiles orphelins
    const allIds = [
      ...((likes || []).map((l) => l.ghost_profile_id)),
      ...((comments || []).map((c) => c.ghost_profile_id)),
    ]
    const uniqueIds = [...new Set(allIds)]
    if (uniqueIds.length > 0) {
      await supabase.from('ghost_profiles').delete().in('id', uniqueIds)
    }
  }

  return {
    setGhostLikes,
    setGhostReposts,
    setGhostComments,
    setFakeCounts,
    fetchGhostLikes,
    fetchGhostComments,
    fetchGhostProfile,
    fetchGhostCounts,
    fetchGhostCommentsMood,
    clearGhostEngagement,
  }
})
