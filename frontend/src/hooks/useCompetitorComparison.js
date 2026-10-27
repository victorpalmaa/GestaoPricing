import { useEffect, useState } from 'react';
import { supabase } from '@/lib/utils';

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function normalizeAttrs(row) {
  return {
    pack_qty: normalizeNumber(row?.pack_qty),
    pack_unit: normalizeText(row?.pack_unit),
    pack_weight_g: normalizeNumber(row?.pack_weight_g),
  };
}

function batchMatches(row, batch) {
  if (!row || !batch) return false;

  const candidateKeys = [
    row.batch_id,
    row.import_batch_id,
    row.competitor_import_batch_id,
    row.competitor_batch_id,
  ].filter((value) => value !== null && value !== undefined);

  if (candidateKeys.length > 0 && batch.id !== null && batch.id !== undefined) {
    return candidateKeys.some((value) => String(value) === String(batch.id));
  }

  const candidateLabels = [
    row.batch,
    row.batch_label,
    row.label,
  ].filter((value) => value !== null && value !== undefined);

  if (candidateLabels.length > 0 && batch.label) {
    return candidateLabels.some((value) => String(value) === String(batch.label));
  }

  const quotedAt = row.quoted_at ? new Date(row.quoted_at).getTime() : NaN;
  const quotedFrom = batch.quoted_from ? new Date(batch.quoted_from).getTime() : NaN;
  const quotedTo = batch.quoted_to ? new Date(batch.quoted_to).getTime() : NaN;

  if (Number.isFinite(quotedAt) && Number.isFinite(quotedFrom) && Number.isFinite(quotedTo)) {
    return quotedAt >= quotedFrom && quotedAt <= quotedTo;
  }

  return true;
}

function getMatchKey(competitor, competitorSku) {
  return `${String(competitor || '').trim()}::${String(competitorSku || '').trim()}`;
}

export function useCompetitorComparison(sku) {
  const [state, setState] = useState({
    loading: false,
    error: '',
    tiers: [],
    pricesByTier: {},
    proAttrs: null,
    batch: null,
    matches: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!sku) {
        if (!cancelled) {
          setState({
            loading: false,
            error: '',
            tiers: [],
            pricesByTier: {},
            proAttrs: null,
            batch: null,
            matches: [],
          });
        }
        return;
      }

      if (!supabase) {
        if (!cancelled) {
          setState({
            loading: false,
            error: 'Supabase não configurado.',
            tiers: [],
            pricesByTier: {},
            proAttrs: null,
            batch: null,
            matches: [],
          });
        }
        return;
      }

      if (!cancelled) {
        setState((prev) => ({
          ...prev,
          loading: true,
          error: '',
        }));
      }

      try {
        const [pricesResult, attrsResult, batchResult, mapResult] = await Promise.all([
          supabase
            .from('catalog_br_prices')
            .select('volume, catalog_gross_price')
            .eq('sku', sku)
            .order('volume', { ascending: true }),
          supabase
            .from('catalog_sku_attributes')
            .select('pack_qty, pack_unit, pack_weight_g')
            .eq('sku', sku)
            .maybeSingle(),
          supabase
            .from('competitor_import_batches')
            .select('*')
            .eq('is_current', true)
            .order('quoted_to', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('competitor_sku_map')
            .select('*')
            .eq('sku', sku)
            .order('competitor', { ascending: true })
            .order('competitor_sku', { ascending: true }),
        ]);

        if (pricesResult.error) throw pricesResult.error;
        if (attrsResult.error) throw attrsResult.error;
        if (batchResult.error) throw batchResult.error;
        if (mapResult.error) throw mapResult.error;

        const priceRows = pricesResult.data || [];
        const tiers = priceRows
          .map((row) => normalizeNumber(row?.volume))
          .filter((value) => value !== null)
          .sort((a, b) => a - b);
        const pricesByTier = priceRows.reduce((acc, row) => {
          const volume = normalizeNumber(row?.volume);
          if (volume !== null) {
            acc[volume] = normalizeNumber(row?.catalog_gross_price);
          }
          return acc;
        }, {});

        const proAttrs = attrsResult.data ? normalizeAttrs(attrsResult.data) : null;
        const batch = batchResult.data || null;
        const mapRows = mapResult.data || [];

        let competitorPrices = [];

        if (mapRows.length > 0) {
          const competitorSkus = [...new Set(
            mapRows
              .map((row) => normalizeText(row?.competitor_sku))
              .filter(Boolean)
          )];

          if (competitorSkus.length > 0) {
            const competitorPricesResult = await supabase
              .from('competitor_prices')
              .select('*')
              .in('competitor_sku', competitorSkus)
              .order('competitor', { ascending: true })
              .order('competitor_sku', { ascending: true })
              .order('volume', { ascending: true });

            if (competitorPricesResult.error) throw competitorPricesResult.error;

            competitorPrices = (competitorPricesResult.data || []).filter((row) => batchMatches(row, batch));
          }
        }

        const quotesByMatch = new Map();
        for (const row of competitorPrices) {
          const competitor = normalizeText(row?.competitor ?? row?.competitor_name);
          const competitorSku = normalizeText(row?.competitor_sku);
          if (!competitor || !competitorSku) continue;

          const key = getMatchKey(competitor, competitorSku);
          if (!quotesByMatch.has(key)) quotesByMatch.set(key, []);
          quotesByMatch.get(key).push({
            volume: normalizeNumber(row?.volume),
            gross_price: normalizeNumber(row?.gross_price),
            quoted_at: row?.quoted_at || batch?.quoted_to || null,
          });
        }

        const matches = mapRows.map((row) => {
          const competitor = normalizeText(row?.competitor ?? row?.competitor_name) || '—';
          const competitorSku = normalizeText(row?.competitor_sku) || '—';
          return {
            competitor,
            competitor_sku: competitorSku,
            match_level: normalizeText(row?.match_level) || 'referencia',
            diff_reason: normalizeText(row?.diff_reason),
            note: normalizeText(row?.note),
            attrs: normalizeAttrs(row),
            quotes: (quotesByMatch.get(getMatchKey(competitor, competitorSku)) || [])
              .filter((quote) => quote.volume !== null && quote.gross_price !== null),
          };
        });

        if (!cancelled) {
          setState({
            loading: false,
            error: '',
            tiers,
            pricesByTier,
            proAttrs,
            batch,
            matches,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            loading: false,
            error: error?.message || 'Não foi possível carregar os preços de concorrentes.',
            tiers: [],
            pricesByTier: {},
            proAttrs: null,
            batch: null,
            matches: [],
          });
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [sku]);

  return state;
}
