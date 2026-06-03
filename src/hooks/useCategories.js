import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const KEY = 'product_categories'

export function useCategories() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useAddCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name) => {
      // Prende il sort_order massimo e aggiunge 1
      const { data: existing } = await supabase
        .from('product_categories')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single()
      const nextOrder = (existing?.sort_order ?? 0) + 1
      const { data, error } = await supabase
        .from('product_categories')
        .insert({ name: name.trim(), sort_order: nextOrder })
        .select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useUpdateCategoriesOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (categories) => {
      // categories = array ordinato di { id, sort_order }
      const updates = categories.map((c, i) =>
        supabase.from('product_categories').update({ sort_order: i + 1 }).eq('id', c.id)
      )
      await Promise.all(updates)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
