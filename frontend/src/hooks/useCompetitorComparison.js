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
            .eq('catalog_sku', sku)
            .maybeSingle(),
          supabase
            .from('competitor_import_batches')
            .select('*')
            .eq('is_current', true)
            .maybeSingle(),
          supabase
            .from('competitor_sku_map')
            .select('catalog_sku, competitor, competitor_sku, match_level, diff_reason, note')
            .eq('catalog_sku', sku)
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

        if (!batch) {
          if (!cancelled) {
            setState({
              loading: false,
              error: 'Nenhum lote de cotações vigente.',
              tiers,
              pricesByTier,
              proAttrs,
              batch: null,
              matches: [],
            });
          }
          return;
        }

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
              .select('batch_id, competitor, competitor_sku, pack_qty, pack_unit, pack_weight_g, volume, gross_price, quoted_at')
              .eq('batch_id', batch.id)
              .in('competitor_sku', competitorSkus)
              .order('competitor', { ascending: true })
              .order('competitor_sku', { ascending: true })
              .order('volume', { ascending: true });

            if (competitorPricesResult.error) throw competitorPricesResult.error;

            competitorPrices = competitorPricesResult.data || [];
          }
        }

        const quotesByMatch = new Map();
        const attrsByMatch = new Map();
        for (const row of competitorPrices) {
          const competitor = normalizeText(row?.competitor);
          const competitorSku = normalizeText(row?.competitor_sku);
          if (!competitor || !competitorSku) continue;

          const key = getMatchKey(competitor, competitorSku);
          if (!quotesByMatch.has(key)) quotesByMatch.set(key, []);
          if (!attrsByMatch.has(key)) attrsByMatch.set(key, normalizeAttrs(row));
          quotesByMatch.get(key).push({
            volume: normalizeNumber(row?.volume),
            gross_price: normalizeNumber(row?.gross_price),
            quoted_at: row?.quoted_at || null,
          });
        }

        const matches = mapRows.map((row) => {
          const competitor = normalizeText(row?.competitor);
          const competitorSku = normalizeText(row?.competitor_sku);
          const key = getMatchKey(competitor, competitorSku);
          return {
            competitor: competitor || '—',
            competitor_sku: competitorSku || '—',
            match_level: normalizeText(row?.match_level) || 'referencia',
            diff_reason: normalizeText(row?.diff_reason),
            note: normalizeText(row?.note),
            attrs: attrsByMatch.get(key) || {
              pack_qty: null,
              pack_unit: null,
              pack_weight_g: null,
            },
            quotes: (quotesByMatch.get(key) || [])
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
