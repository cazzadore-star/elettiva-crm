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
        .order('company_name', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

// Popola il report da forecast: copia i valori scalandoli di -1 mese
// forecast feb (month=2) → report gen (month=1)
// forecast gen (month=1) → non copiato (non esiste mese 0)
export function usePopulateReportFromForecast() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (year) => {
      // Legge tutte le righe forecast per l'anno
      const { data: forecastLines, error } = await supabase
        .from('forecast_full')
        .select('customer_id, product_id, month, qty_pieces, avg_price_snapshot')
        .eq('year', year)
        .gte('month', 2) // solo da febbraio in poi (gen forecast → non ha mese 0 report)
      if (error) throw error

      if (!forecastLines || forecastLines.length === 0) return

      // Trasforma: mese forecast → mese report (- 1)
      const reportRows = forecastLines.map(fl => ({
        year,
        customer_id: fl.customer_id,
        product_id:  fl.product_id,
        month:       fl.month - 1,  // anticipo di 1
        qty_pieces:  fl.qty_pieces,
        avg_price:   fl.avg_price_snapshot,
      }))

      // Upsert: non sovrascrive valori già modificati manualmente
      const { error: upsertError } = await supabase
        .from('report_lines')
        .upsert(reportRows, {
          onConflict: 'year,customer_id,product_id,month',
          ignoreDuplicates: true, // non sovrascrive se esiste già
        })
      if (upsertError) throw upsertError
    },
    onSuccess: (_, year) => qc.invalidateQueries({ queryKey: [KEY, 'pivot', year] }),
  })
}

export function useUpsertReportLine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ year, customer_id, product_id, month, qty_pieces, avg_price }) => {
      const { error } = await supabase
        .from('report_lines')
        .upsert(
          { year, customer_id, product_id, month, qty_pieces, avg_price },
          { onConflict: 'year,customer_id,product_id,month' }
        )
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: [KEY, 'pivot', vars.year] }),
  })
}
