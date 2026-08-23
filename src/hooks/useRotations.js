import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const KEY = 'rotations'

export function useRotations() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rotations_full')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

// Prodotti con info se sono già in una rotazione attiva per quel cliente
export function useProductsWithRotationInfo(customerId) {
  return useQuery({
    queryKey: ['products_rotation_info', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data: products, error } = await supabase
        .from('products')
        .select('id, ean, description, sku, brand_id')
        .eq('active', true)
        .order('description')
      if (error) throw error

      // Cerca rotazioni attive per questo cliente
      const { data: rotationProducts } = await supabase
        .from('rotation_products')
        .select('product_id, rotations(period_start, period_end, customer_id)')
        .eq('rotations.customer_id', customerId)

      // Mappa product_id -> info rotazione
      const rotationMap = {}
      if (rotationProducts) {
        for (const rp of rotationProducts) {
          if (rp.rotations && rp.rotations.customer_id == customerId) {
            rotationMap[rp.product_id] = rp.rotations
          }
        }
      }

      return products.map(p => ({
        ...p,
        inRotation: !!rotationMap[p.id],
        rotationPeriod: rotationMap[p.id]
          ? formatPeriod(rotationMap[p.id].period_start, rotationMap[p.id].period_end)
          : null,
      }))
    },
  })
}

function formatPeriod(start, end) {
  const s = new Date(start).toLocaleDateString('it-IT', { month: 'short', year: '2-digit' })
  const e = new Date(end).toLocaleDateString('it-IT', { month: 'short', year: '2-digit' })
  return `${s} - ${e}`
}

export function useCreateRotation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ rotation, productIds }) => {
      // 1. Crea la rotazione
      const { data: rot, error: rotError } = await supabase
        .from('rotations')
        .insert(rotation)
        .select()
        .single()
      if (rotError) throw rotError

      // 2. Inserisce i prodotti
      const { error: prodError } = await supabase
        .from('rotation_products')
        .insert(productIds.map(pid => ({ rotation_id: rot.id, product_id: pid })))
      if (prodError) throw prodError

      // 3. Applica al forecast
      const { error: applyError } = await supabase
        .rpc('apply_rotation_to_forecast', { p_rotation_id: rot.id })
      if (applyError) throw applyError

      return rot
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] })
      qc.invalidateQueries({ queryKey: ['forecast'] })
    },
  })
}

export function useDeleteRotation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('rotations')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useUpdateRotation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, rotation, productIds }) => {
      // 1. Aggiorna la rotazione
      const { error: rotError } = await supabase
        .from('rotations')
        .update(rotation)
        .eq('id', id)
      if (rotError) throw rotError

      // 2. Sostituisce i prodotti
      await supabase.from('rotation_products').delete().eq('rotation_id', id)
      const { error: prodError } = await supabase
        .from('rotation_products')
        .insert(productIds.map(pid => ({ rotation_id: id, product_id: pid })))
      if (prodError) throw prodError

      // 3. Riapplica al forecast
      const { error: applyError } = await supabase
        .rpc('apply_rotation_to_forecast', { p_rotation_id: id })
      if (applyError) throw applyError
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] })
      qc.invalidateQueries({ queryKey: ['forecast'] })
    },
  })
}