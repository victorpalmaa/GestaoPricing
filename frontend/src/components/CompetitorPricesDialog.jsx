import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  Info,
  Layers,
  Scale,
  X,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCompetitorComparison } from '@/hooks/useCompetitorComparison';
import { ageBadge as getAgeBadge, buildComparison, formatDelta } from '@/lib/pricing/competitorComparison';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const COLOR_PRO_PURPLE = {
  bar: '#7B5FFF',
  text: '#5A3FA8',
  textDark: '#A99BFF',
  bg: 'rgba(123,95,255,0.10)',
  border: 'rgba(123,95,255,0.45)',
};

const COLOR_PRO_GREEN = {
  dot: '#64D020',
  text: '#3F7F12',
  textDark: '#9BE07A',
  bg: 'rgba(100,208,32,0.10)',
  border: 'rgba(100,208,32,0.45)',
};

const COLOR_PRO_BLUE = {
  dot: '#1AC6FC',
  text: '#0B6E91',
  textDark: '#7FDBFF',
  bg: 'rgba(26,198,252,0.10)',
  border: 'rgba(26,198,252,0.45)',
};

const COLOR_NAVY = '#1E0050';

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '–';
  const number = Number(value);
  if (!Number.isFinite(number)) return '–';
  return `R$ ${number.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatVolume(value) {
  if (value === null || value === undefined || value === '') return '–';
  const number = Number(value);
  if (!Number.isFinite(number)) return '–';
  return number.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatMonthYear(value) {
  if (!value) return '–';
  try {
    return format(parseISO(value), 'MMM/yy', { locale: ptBR }).toLowerCase();
  } catch {
    return '–';
  }
}

function metricSuffix(basis) {
  if (basis === 'r100g') return '/100g';
  if (basis === 'runidade') return '/un';
  return '';
}

function formatMetric(value, basis) {
  if (value === null || value === undefined || !basis) return '–';
  const number = Number(value);
  if (!Number.isFinite(number)) return '–';
  return `R$ ${number.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}${metricSuffix(basis)}`;
}

function levelLabel(level) {
  if (level === 'exato') return 'Exato';
  if (level === 'similar') return 'Similar';
  return 'Referência';
}

function formatSize(attrs) {
  if (attrs?.pack_weight_g != null && Number.isFinite(Number(attrs.pack_weight_g)) && Number(attrs.pack_weight_g) > 0) {
    return `${Number(attrs.pack_weight_g).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}g`;
  }

  if (attrs?.pack_qty != null && Number.isFinite(Number(attrs.pack_qty)) && Number(attrs.pack_qty) > 0 && attrs?.pack_unit) {
    return `${Number(attrs.pack_qty).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })} ${attrs.pack_unit}`;
  }

  return '–';
}

function getPositionTone(delta) {
  if (delta == null || !Number.isFinite(delta) || Math.abs(delta) < 0.005) return COLOR_PRO_PURPLE;
  return delta < 0 ? COLOR_PRO_GREEN : COLOR_PRO_BLUE;
}

function getDeltaPillTone(delta) {
  if (delta == null || !Number.isFinite(delta)) {
    return {
      border: 'rgba(209,213,219,1)',
      bg: 'rgba(249,250,251,1)',
      text: '#374151',
      textDark: '#E5E7EB',
    };
  }

  return delta < 0
    ? { border: COLOR_PRO_GREEN.border, bg: COLOR_PRO_GREEN.bg, text: COLOR_PRO_GREEN.text, textDark: COLOR_PRO_GREEN.textDark }
    : { border: COLOR_PRO_BLUE.border, bg: COLOR_PRO_BLUE.bg, text: COLOR_PRO_BLUE.text, textDark: COLOR_PRO_BLUE.textDark };
}

function getLevelDots(level) {
  if (level === 'exato') {
    return [COLOR_PRO_GREEN.dot, COLOR_PRO_GREEN.dot, COLOR_PRO_GREEN.dot];
  }
  if (level === 'similar') {
    return [COLOR_PRO_BLUE.dot, COLOR_PRO_BLUE.dot, '#D1D5DB'];
  }
  return ['#9CA3AF', '#E5E7EB', '#E5E7EB'];
}

function deltaIcon(delta) {
  if (delta == null || !Number.isFinite(delta) || delta === 0) return null;
  return delta > 0 ? ArrowUp : ArrowDown;
}

function getAgeText(badge) {
  if (badge === 'warn') return { text: '⚠ 6-12 meses', className: 'text-[#B45309] dark:text-amber-300' };
  if (badge === 'stale') return { text: 'desatualizada', className: 'text-gray-500 dark:text-gray-400' };
  return null;
}

function batchLabel(batch) {
  if (!batch?.label) return null;
  return `Lote ${batch.label} · cotações de ${formatMonthYear(batch.quoted_from)} a ${formatMonthYear(batch.quoted_to)}`;
}

const LoadingState = () => (
  <div className="space-y-6">
    <div className="flex flex-wrap gap-2">
      <Skeleton className="h-10 w-24 rounded-lg" />
      <Skeleton className="h-10 w-24 rounded-lg" />
      <Skeleton className="h-10 w-24 rounded-lg" />
    </div>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Skeleton className="h-28 w-full rounded-lg" />
      <Skeleton className="h-28 w-full rounded-lg" />
      <Skeleton className="h-28 w-full rounded-lg" />
    </div>
    <Skeleton className="h-36 w-full rounded-lg" />
    <div className="space-y-3">
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  </div>
);

const EmptyState = () => (
  <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-[#111111] dark:text-gray-400">
    Sem concorrente mapeado para este SKU.
  </div>
);

const ErrorState = ({ error }) => (
  <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">
    <AlertTriangle className="h-4 w-4" />
    <AlertTitle>Erro ao carregar comparativo</AlertTitle>
    <AlertDescription>{error}</AlertDescription>
  </Alert>
);

const CompetitorPricesDialog = ({ sku, open, onOpenChange }) => {
  const { loading, error, tiers, pricesByTier, proAttrs, batch, matches } = useCompetitorComparison(sku);
  const [selectedTier, setSelectedTier] = useState('');
  const [referenceOpen, setReferenceOpen] = useState(false);

  useEffect(() => {
    if (tiers.length === 0) {
      setSelectedTier('');
      return;
    }

    const nextTier = String(tiers[0]);
    setSelectedTier((prev) => (tiers.some((tier) => String(tier) === prev) ? prev : nextTier));
  }, [tiers, sku]);

  const comparison = useMemo(() => {
    if (!selectedTier) return null;
    return buildComparison({
      tier: Number(selectedTier),
      proPrice: pricesByTier[selectedTier],
      proAttrs,
      matches,
      today: new Date().toISOString(),
    });
  }, [matches, pricesByTier, proAttrs, selectedTier]);

  const headerBatchLabel = batchLabel(batch);
  const summary = comparison?.summary || null;
  const selectedProPrice = selectedTier ? pricesByTier[selectedTier] : null;
  const directRows = useMemo(
    () => (comparison?.rows || []).filter((row) => row.match_level === 'exato' || row.match_level === 'similar'),
    [comparison]
  );
  const referenceRows = useMemo(
    () => (comparison?.rows || []).filter((row) => row.match_level === 'referencia'),
    [comparison]
  );
  const eligibleRows = useMemo(
    () => (comparison?.rows || []).filter(
      (row) =>
        (row.match_level === 'exato' || row.match_level === 'similar') &&
        row.basis === summary?.preferredBasis &&
        row.outOfTier === false &&
        row.delta != null
    ),
    [comparison, summary]
  );
  const onlyReference = directRows.length === 0 && referenceRows.length > 0;
  const singleComparable = summary?.n === 1 ? eligibleRows[0] || null : null;
  const proMetricRow = eligibleRows[0] || directRows.find((row) => row.mPro != null && row.basis) || null;
  const proMetricValue = proMetricRow?.mPro ?? null;
  const proMetricBasis = proMetricRow?.basis ?? null;
  const proSizeLabel = formatSize({
    pack_weight_g: summary?.preferredBasis === 'r100g' ? proAttrs?.pack_weight_g : null,
    pack_qty: proAttrs?.pack_qty,
    pack_unit: proAttrs?.pack_unit,
  });
  const positionDelta = summary?.n >= 2 ? summary?.deltaVsMedian : singleComparable?.delta ?? null;
  const positionTone = getPositionTone(positionDelta);
  const marketScaleRows = useMemo(() => {
    if (!eligibleRows.length || proMetricValue == null) return [];
    const items = [
      ...eligibleRows.map((row) => ({
        key: `${row.competitor}-${row.competitor_sku}`,
        label: `${row.competitor} · ${formatSize(row.attrs)}`,
        value: row.mConc,
        price: row.quote?.gross_price ?? null,
        isPro: false,
      })),
      {
        key: 'pro',
        label: `PRO · ${proSizeLabel}`,
        value: proMetricValue,
        price: selectedProPrice,
        isPro: true,
      },
    ].sort((a, b) => a.value - b.value);

    const maxValue = items.reduce((acc, item) => Math.max(acc, item.value || 0), 0);
    return items.map((item) => ({
      ...item,
      width: maxValue > 0 ? Math.max(6, (item.value / maxValue) * 100) : 0,
      medianLeft: summary?.n >= 2 ? (summary.median / maxValue) * 100 : null,
    }));
  }, [eligibleRows, proMetricValue, proSizeLabel, selectedProPrice, summary]);

  useEffect(() => {
    setReferenceOpen(onlyReference);
  }, [onlyReference, sku, selectedTier]);

  const renderDeltaPill = (delta) => {
    const Icon = deltaIcon(delta);
    const tone = getDeltaPillTone(delta);
    return (
      <div
        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold"
        style={{
          borderColor: tone.border,
          backgroundColor: tone.bg,
          color: tone.text,
        }}
      >
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        <span>{delta == null ? '–' : formatDelta(delta)}</span>
      </div>
    );
  };

  const renderInfoPopover = () => (
    <PopoverContent
      align="end"
      className="w-[380px] border-gray-200 bg-white p-4 text-gray-700 shadow-xl dark:border-gray-800 dark:bg-[#1e1e1e] dark:text-gray-300"
    >
      <div className="space-y-4 text-sm">
        <div className="space-y-2">
          <p className="border-l-[3px] pl-3 text-xs font-medium uppercase tracking-wider text-[#5A3FA8] dark:text-[#A99BFF]" style={{ borderColor: COLOR_PRO_PURPLE.bar }}>
            COMO LER O Δ
          </p>
          <div className="rounded-lg border border-[rgba(123,95,255,0.15)] bg-[rgba(123,95,255,0.04)] p-3 dark:border-[rgba(123,95,255,0.25)] dark:bg-[rgba(123,95,255,0.08)]">
            <div className="mb-2 flex items-center justify-between text-[11px]">
              <span className="font-medium text-[#3F7F12] dark:text-[#9BE07A]">mais barato</span>
              <span>0</span>
              <span className="font-medium text-[#0B6E91] dark:text-[#7FDBFF]">mais caro</span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full">
              <div className="absolute inset-y-0 left-0 w-1/2 bg-[rgba(100,208,32,0.18)]" />
              <div className="absolute inset-y-0 right-0 w-1/2 bg-[rgba(26,198,252,0.18)]" />
              <div className="absolute left-1/2 top-[-3px] h-4 w-[2px] -translate-x-1/2 bg-[#1E0050] dark:bg-[#A99BFF]" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {renderDeltaPill(-0.25)}
              {renderDeltaPill(0.11)}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Δ = PRO ÷ concorrente − 1</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="border-l-[3px] pl-3 text-xs font-medium uppercase tracking-wider text-[#5A3FA8] dark:text-[#A99BFF]" style={{ borderColor: COLOR_PRO_PURPLE.bar }}>
            NÍVEL DO MATCH
          </p>
          <div className="space-y-2 rounded-lg border border-[rgba(123,95,255,0.15)] bg-[rgba(123,95,255,0.04)] p-3 dark:border-[rgba(123,95,255,0.25)] dark:bg-[rgba(123,95,255,0.08)]">
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1">
                {getLevelDots('exato').map((color, index) => (
                  <span key={`popover-exato-${index}`} className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                ))}
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">Exato</span>
              <span className="text-gray-500 dark:text-gray-400">mesmo produto e tamanho</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1">
                {getLevelDots('similar').map((color, index) => (
                  <span key={`popover-similar-${index}`} className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                ))}
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">Similar</span>
              <span className="whitespace-nowrap text-gray-500 dark:text-gray-400">tamanho ou emb. diferente · R$/100g ou R$/un</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1">
                {getLevelDots('referencia').map((color, index) => (
                  <span key={`popover-referencia-${index}`} className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                ))}
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">Referência</span>
              <span className="text-gray-500 dark:text-gray-400">só a categoria, sem comparação</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="border-l-[3px] pl-3 text-xs font-medium uppercase tracking-wider text-[#5A3FA8] dark:text-[#A99BFF]" style={{ borderColor: COLOR_PRO_PURPLE.bar }}>
            DADOS
          </p>
          <div className="space-y-2 rounded-lg border border-[rgba(123,95,255,0.15)] bg-[rgba(123,95,255,0.04)] p-3 dark:border-[rgba(123,95,255,0.25)] dark:bg-[rgba(123,95,255,0.08)]">
            <div className="flex items-start gap-2 text-xs">
              <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7B5FFF] dark:text-[#A99BFF]" />
              <span>Lote {batch?.label || 'vigente'} · {formatMonthYear(batch?.quoted_from)}–{formatMonthYear(batch?.quoted_to)} · semestral</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7B5FFF] dark:text-[#A99BFF]" />
              <span>Preço bruto × preço bruto</span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7B5FFF] dark:text-[#A99BFF]" />
              <span>Usa a cotação de maior volume até a faixa</span>
            </div>
          </div>
        </div>
      </div>
    </PopoverContent>
  );

  const renderCompetitorCard = (row, simplified = false) => {
    const badge = row.quote?.quoted_at ? getAgeBadge(row.quote.quoted_at, new Date().toISOString()) : null;
    const ageText = getAgeText(badge);
    const notes = [row.diff_reason, row.note].filter(Boolean);
    const dots = getLevelDots(row.match_level);

    return (
      <div
        key={`${row.competitor}-${row.competitor_sku}-${row.match_level}`}
        className={cn(
          'rounded-md p-3 bg-white dark:bg-gray-900/30 border border-gray-100 dark:border-gray-800',
          row.outOfTier && 'opacity-60'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{row.competitor || '–'}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">· {row.competitor_sku || '–'}</span>
            </div>
          </div>
          {simplified ? (
            <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-200">
              {levelLabel(row.match_level)}
            </div>
          ) : (
            renderDeltaPill(row.delta)
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1">
              {dots.map((color, index) => (
                <span
                  key={`${row.match_level}-${index}`}
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>
            <span>{levelLabel(row.match_level)}</span>
          </span>
          <span>{row.quote?.volume != null ? `${formatVolume(row.quote.volume)} un` : '–'}</span>
          <span>{row.quote ? formatCurrency(row.quote.gross_price) : '–'}</span>
          <span>{formatMetric(row.mConc, row.basis)}</span>
          <span className="flex flex-wrap items-center gap-1">
            <span>{row.quote?.quoted_at ? formatMonthYear(row.quote.quoted_at) : '–'}</span>
            {ageText ? <span className={ageText.className}>{ageText.text}</span> : null}
          </span>
        </div>

        {(notes.length > 0 || row.outOfTier) && (
          <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
            {notes.map((note) => (
              <div key={note}>{note}</div>
            ))}
            {row.outOfTier && row.quote?.volume != null && (
              <div>cotação a partir de {formatVolume(row.quote.volume)} un, fora da síntese</div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-xl overflow-hidden border border-gray-200 bg-white p-0 shadow-2xl dark:border-gray-800 dark:bg-[#1e1e1e] [&>button]:hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="rounded-full p-2 shrink-0"
                style={{ backgroundColor: COLOR_PRO_PURPLE.bg }}
              >
                <BarChart3 className="w-5 h-5" style={{ color: COLOR_PRO_PURPLE.text }} />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white truncate">
                  Concorrentes · {sku || 'SKU'}
                </DialogTitle>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {headerBatchLabel || 'Lote vigente'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                    aria-label="Como ler"
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                {renderInfoPopover()}
              </Popover>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                onClick={() => onOpenChange(false)}
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {tiers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Faixa</p>
              <ToggleGroup
                type="single"
                value={selectedTier}
                onValueChange={(value) => value && setSelectedTier(value)}
                variant="outline"
                className="justify-start flex-wrap rounded-lg bg-gray-50 p-1 dark:bg-gray-900/30"
              >
                {tiers.map((tier) => (
                  <ToggleGroupItem
                    key={tier}
                    value={String(tier)}
                    className="min-w-[72px] rounded-md border border-gray-200 bg-white text-gray-700 shadow-none dark:border-gray-700 dark:bg-[#171717] dark:text-gray-300 data-[state=on]:border-[#7B5FFF] data-[state=on]:bg-[#7B5FFF] data-[state=on]:text-white"
                  >
                    {formatVolume(tier)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState error={error} />
          ) : matches.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className={cn('grid grid-cols-1 gap-3', !onlyReference && 'md:grid-cols-3')}>
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 p-3">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    PREÇO BRUTO PRO
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatCurrency(selectedProPrice)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {formatMetric(proMetricValue, proMetricBasis)}
                  </p>
                </div>

                {!onlyReference && (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 p-3">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      REFERÊNCIA DE MERCADO
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {summary?.n >= 2 ? formatMetric(summary?.median, summary?.preferredBasis) : '–'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {summary?.n >= 2 ? `mediana de ${summary.n}` : 'poucos concorrentes'}
                    </p>
                    {summary?.n >= 2 && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        ≈ {formatCurrency(summary?.medianProductEquivalent)} no tamanho PRO ({proSizeLabel})
                      </p>
                    )}
                  </div>
                )}

                {!onlyReference && (
                  <div
                    className="rounded-lg border p-3"
                    style={{
                      borderColor: positionTone.border,
                      borderWidth: '2px',
                      backgroundColor: positionTone.bg,
                    }}
                  >
                    <p
                      className="text-xs font-medium uppercase tracking-wider mb-1"
                      style={{ color: positionTone.text }}
                    >
                      POSIÇÃO
                    </p>
                    <p className="text-xl font-extrabold" style={{ color: positionTone.text }}>
                      {summary?.n >= 2
                        ? formatDelta(summary.deltaVsMedian)
                        : singleComparable
                          ? formatDelta(singleComparable.delta)
                          : '–'}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: positionTone.text }}>
                      {summary?.n >= 2
                        ? `${summary.position}º mais barato de ${summary.total}`
                        : singleComparable
                          ? `vs ${singleComparable.competitor}`
                          : 'sem comparação'}
                    </p>
                  </div>
                )}
              </div>

              {!onlyReference && summary?.n >= 1 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    RÉGUA DE MERCADO
                  </h4>
                  <div className="relative rounded-lg border border-gray-200 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-900/30 space-y-3">
                    {summary?.n >= 2 && marketScaleRows[0]?.medianLeft != null && (
                      <div
                        className="absolute top-6 bottom-4 border-l border-dashed pointer-events-none"
                        style={{
                          left: `calc(7rem + 0.75rem + ${Math.max(0, Math.min(100, marketScaleRows[0].medianLeft))} * ((100% - 7rem - 7.5rem - 1.5rem) / 100))`,
                          borderColor: COLOR_NAVY,
                        }}
                      >
                        <span
                          className="absolute -top-4 -translate-x-1/2 text-[10px] uppercase tracking-wider"
                          style={{ color: COLOR_NAVY }}
                        >
                          mediana
                        </span>
                      </div>
                    )}
                    {marketScaleRows.map((item) => (
                      <div key={item.key} className="flex items-center gap-3">
                        <div className={cn('w-28 shrink-0 truncate text-xs', item.isPro ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400')}>
                          {item.label}
                        </div>
                        <div className="flex-1 h-6 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800">
                          <div
                            className={cn('h-full rounded-md', item.isPro ? 'bg-[#7B5FFF]' : 'bg-gray-300 dark:bg-gray-700')}
                            style={{ width: `${item.width}%` }}
                          />
                        </div>
                        <div className="w-[7.5rem] shrink-0 text-right">
                          <div className={cn('text-xs', item.isPro ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-200')}>
                            {formatCurrency(item.price)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatMetric(item.value, summary?.preferredBasis)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  CONCORRENTES
                </h4>
                {directRows.length > 0 ? (
                  <div className="space-y-2">
                    {directRows.map((row) => renderCompetitorCard(row))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-4 text-sm text-gray-500 dark:text-gray-400">
                    Sem concorrentes Exato ou Similar para a faixa selecionada.
                  </div>
                )}
              </div>

              {referenceRows.length > 0 && (
                <Collapsible open={referenceOpen} onOpenChange={setReferenceOpen} defaultOpen={onlyReference}>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-4 py-3 text-left"
                      >
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Outros da categoria (sem comparação direta) · {referenceRows.length}
                        </span>
                        {referenceOpen ? (
                          <ChevronUp className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        )}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="border-t border-gray-200 px-4 py-3 dark:border-gray-800">
                      <div className="space-y-2">
                        {referenceRows.map((row) => renderCompetitorCard(row, true))}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )}
            </>
          )}
        </div>

        <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-[#171717]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Preço bruto PRO × preço bruto do concorrente · Lote {batch?.label || 'vigente'}
            </p>
            <Button
              type="button"
              variant="outline"
              className="border-gray-200 bg-white text-gray-900 hover:bg-gray-100 dark:border-gray-700 dark:bg-[#171717] dark:text-white dark:hover:bg-gray-800"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CompetitorPricesDialog;
