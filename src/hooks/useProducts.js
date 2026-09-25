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

// Crea più prodotti in una volta (usato dall'import Sell-in per i prodotti non trovati per EAN)
export function useCreateProductsBulk() {
  const qc = useQueryClient()
  return useMutation({
    // rows = [{ ean, sku, description, description_report, brand_id }]
    mutationFn: async (rows) => {
      const payload = rows.map(r => ({
        ean:                r.ean,
        sku:                r.sku || null,
        description:        r.description,
        description_report: r.description_report || r.description,
        brand_id:           r.brand_id || null,
        category_id:        null,
        active:             true,
      }))
      const { data, error } = await supabase.from('products').insert(payload).select()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
