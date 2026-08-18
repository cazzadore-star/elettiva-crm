import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const KEY = 'report'

// Vista aggregata per prodotto (tutti i clienti insieme) - usata quando nessun filtro cliente è attivo
export function useReportPivot() {
  return useQuery({
    queryKey: [KEY, 'pivot', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_pivot')
        .select('*')
        .order('category_id', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data
    },
  })
}

// Vista con dettaglio cliente - usata per filtrare per cliente specifico
export function useReportPivotByCustomer() {
  return useQuery({
    queryKey: [KEY, 'pivot_by_customer', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_pivot_by_customer')
        .select('*')
        .order('category_id', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data
    },
  })
}

export function usePopulateReportFromForecast() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (year) => {
      const { error } = await supabase.rpc('populate_report_from_forecast', { p_year: year })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useUpsertReportLine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ year, product_id, month, qty_pieces, avg_price }) => {
      const { error } = await supabase
        .from('report_lines')
        .update({ qty_pieces, avg_price })
        .eq('year', year)
        .eq('product_id', product_id)
        .eq('month', month)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}