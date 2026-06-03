import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const KEY = 'price_lists'

export function usePriceLists({ includeInactive = false } = {}) {
  return useQuery({
    queryKey: [KEY, includeInactive],
    queryFn: async () => {
      let q = supabase
        .from('price_lists')
        .select(`
          *,
          customers ( id, company_name ),
          products  ( id, ean, description )
        `)
        .order('created_at', { ascending: false })
      if (!includeInactive) q = q.eq('active', true)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useActivePriceForPair(customerId, productId) {
  return useQuery({
    queryKey: [KEY, 'pair', customerId, productId],
    enabled: !!customerId && !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_lists')
        .select('*')
        .eq('customer_id', customerId)
        .eq('product_id', productId)
        .eq('active', true)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useUpsertPriceList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (pl) => {
      if (pl.id) {
        // modifica esistente
        const { data, error } = await supabase
          .from('price_lists')
          .update({ avg_price: pl.avg_price, active: pl.active })
          .eq('id', pl.id)
          .select().single()
        if (error) throw error
        return data
      } else {
        // nuovo: prima disattiva eventuale listino attivo per la stessa coppia
        await supabase
          .from('price_lists')
          .update({ active: false })
          .eq('customer_id', pl.customer_id)
          .eq('product_id', pl.product_id)
          .eq('active', true)

        const { data, error } = await supabase
          .from('price_lists')
          .insert({
            customer_id: pl.customer_id,
            product_id:  pl.product_id,
            avg_price:   pl.avg_price,
          })
          .select().single()
        if (error) throw error
        return data
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useTogglePriceListActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, active }) => {
      const { error } = await supabase
        .from('price_lists')
        .update({ active })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
