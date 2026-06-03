import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const KEY = 'report'

export function useReportPivot(year) {
  return useQuery({
    queryKey: [KEY, 'pivot', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_pivot')
        .select('*')
        .eq('year', year)
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
    onSuccess: (_, year) => qc.invalidateQueries({ queryKey: [KEY, 'pivot', year] }),
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
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: [KEY, 'pivot', vars.year] }),
  })
}
