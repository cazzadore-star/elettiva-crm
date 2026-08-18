import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const KEY = 'forecast'

export function useForecastPivot(year) {
  return useQuery({
    queryKey: [KEY, 'pivot', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forecast_pivot')
        .select('*')
        .eq('year', year)
        .order('company_name', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useForecastPivotAll() {
  return useQuery({
    queryKey: [KEY, 'pivot', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forecast_pivot')
        .select('*')
        .order('company_name', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useForecastHeader(year, customerId, productId) {
  return useQuery({
    queryKey: [KEY, 'header', year, customerId, productId],
    enabled: !!year && !!customerId && !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forecast_headers')
        .select('*, forecast_lines(*)')
        .eq('year', year)
        .eq('customer_id', customerId)
        .eq('product_id', productId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useCreateForecastHeader() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ year, customer_id, product_id, avg_price_snapshot }) => {
      const { data, error } = await supabase
        .from('forecast_headers')
        .insert({ year, customer_id, product_id, avg_price_snapshot })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [KEY, 'pivot', vars.year] })
    },
  })
}

export function useUpdateForecastLine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ headerId, month, qty_pieces, year }) => {
      const { error } = await supabase
        .from('forecast_lines')
        .update({ qty_pieces })
        .eq('header_id', headerId)
        .eq('month', month)
      if (error) throw error
      return { headerId, month, qty_pieces, year }
    },
    onSuccess: (vars) => {
      qc.invalidateQueries({ queryKey: [KEY, 'pivot', vars.year] })
    },
  })
}

export function useDeleteForecastHeader() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, year }) => {
      const { error } = await supabase
        .from('forecast_headers')
        .delete()
        .eq('id', id)
      if (error) throw error
      return { year }
    },
    onSuccess: (vars) => {
      qc.invalidateQueries({ queryKey: [KEY, 'pivot', vars.year] })
    },
  })
}

export function useRecalcForecastFromRotations() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('recalc_forecast_from_rotations')
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forecast'] }),
  })
}