import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const KEY = 'sellin'

// ------------------------------------------------------------
// Mapping cliente gestionale -> cliente CRM (permanente)
// ------------------------------------------------------------
export function useCustomerMappings() {
  return useQuery({
    queryKey: [KEY, 'customer_mapping'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sellin_customer_mapping')
        .select('*, customers(company_name)')
      if (error) throw error
      return data
    },
  })
}

export function useUpsertCustomerMapping() {
  const qc = useQueryClient()
  return useMutation({
    // rows = [{ gestionale_code, gestionale_name, customer_id }]
    mutationFn: async (rows) => {
      const { error } = await supabase
        .from('sellin_customer_mapping')
        .upsert(rows, { onConflict: 'gestionale_code' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'customer_mapping'] }),
  })
}

// ------------------------------------------------------------
// Import: lista, dettaglio, creazione, eliminazione
// ------------------------------------------------------------
export function useSellinImports() {
  return useQuery({
    queryKey: [KEY, 'imports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sellin_imports')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useDeleteSellinImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('sellin_imports').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

// Punti vendita per cliente di un import specifico
export function useImportCustomers(importId) {
  return useQuery({
    queryKey: [KEY, 'import_customers', importId],
    enabled: !!importId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sellin_import_customers')
        .select('*, customers(company_name)')
        .eq('import_id', importId)
      if (error) throw error
      return data
    },
  })
}

export function useUpdateImportCustomerPoints() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ import_id, customer_id, num_points }) => {
      const { error } = await supabase
        .from('sellin_import_customers')
        .upsert({ import_id, customer_id, num_points }, { onConflict: 'import_id,customer_id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

// ------------------------------------------------------------
// Finalizzazione import: scrive tutto in un'unica transazione lato client
// (header import, mapping clienti nuovi, punti vendita, righe)
// ------------------------------------------------------------
export function useFinalizeSellinImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, year, numMonths, newMappings, importCustomers, lines }) => {
      // 1. Crea l'header import
      const { data: imp, error: impErr } = await supabase
        .from('sellin_imports')
        .insert({ name, year, num_months: numMonths })
        .select()
        .single()
      if (impErr) throw impErr

      // 2. Salva i nuovi abbinamenti cliente (permanenti)
      if (newMappings.length > 0) {
        const { error: mapErr } = await supabase
          .from('sellin_customer_mapping')
          .upsert(newMappings, { onConflict: 'gestionale_code' })
        if (mapErr) throw mapErr
      }

      // 3. Salva i punti vendita per cliente di questo import
      const pdvRows = importCustomers.map(c => ({ import_id: imp.id, customer_id: c.customer_id, num_points: c.num_points }))
      if (pdvRows.length > 0) {
        const { error: pdvErr } = await supabase.from('sellin_import_customers').insert(pdvRows)
        if (pdvErr) throw pdvErr
      }

      // 4. Salva le righe normalizzate, a blocchi da 500 per evitare payload troppo grandi
      const rowsWithImport = lines.map(l => ({ ...l, import_id: imp.id }))
      const CHUNK = 500
      for (let i = 0; i < rowsWithImport.length; i += CHUNK) {
        const chunk = rowsWithImport.slice(i, i + CHUNK)
        const { error: linesErr } = await supabase.from('sellin_lines').insert(chunk)
        if (linesErr) throw linesErr
      }

      return imp
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

// ------------------------------------------------------------
// Report pivot (vista sellin_pivot)
// ------------------------------------------------------------
export function useSellinPivot(importId) {
  return useQuery({
    queryKey: [KEY, 'pivot', importId],
    enabled: !!importId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sellin_pivot')
        .select('*')
        .eq('import_id', importId)
        .order('company_name', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

// ------------------------------------------------------------
// Anni disponibili (per il selettore del report annuale)
// ------------------------------------------------------------
export function useSellinYears() {
  return useQuery({
    queryKey: [KEY, 'years'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sellin_imports')
        .select('year')
        .order('year', { ascending: false })
      if (error) throw error
      return [...new Set(data.map(r => r.year))]
    },
  })
}

// Report annuale: somma automaticamente tutti gli import dello stesso anno
export function useSellinPivotYearly(year) {
  return useQuery({
    queryKey: [KEY, 'pivot_yearly', year],
    enabled: !!year,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sellin_pivot_yearly')
        .select('*')
        .eq('year', year)
        .order('company_name', { ascending: true })
      if (error) throw error
      return data
    },
  })
}
