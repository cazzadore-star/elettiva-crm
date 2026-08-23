import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const KEY = 'products'

export function useProducts({ includeInactive = false } = {}) {
  return useQuery({
    queryKey: [KEY, includeInactive],
    queryFn: async () => {
      let q = supabase
        .from('products')
        .select('*, product_categories(id, name)')
        .order('description', { ascending: true })
      if (!includeInactive) q = q.eq('active', true)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useUpsertProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (product) => {
      const payload = {
        ean:                product.ean,
        sku:                product.sku || null,
        description:        product.description,
        description_report: product.description_report || null,
        active:             product.active ?? true,
        category_id:        product.category_id || null,
        brand_id:           product.brand_id || null,
      }
      const { data, error } = product.id
        ? await supabase.from('products').update(payload).eq('id', product.id).select().single()
        : await supabase.from('products').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useToggleProductActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, active }) => {
      const { error } = await supabase.from('products').update({ active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
