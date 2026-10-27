import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCompetitorComparison } from '@/hooks/useCompetitorComparison';
import { ageBadge as getAgeBadge, buildComparison, formatDelta } from '@/lib/pricing/competitorComparison';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

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
    return format(new Date(value), 'MMM/yy', { locale: ptBR }).toLowerCase();
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
  if (level === 'exato') return '●●● Exato';
  if (level === 'similar') return '●●○ Similar';
  return '●○○ Referência';
}

function batchLabel(batch) {
  if (!batch?.label) return null;
  return `Lote ${batch.label} · cotações de ${formatMonthYear(batch.quoted_from)} a ${formatMonthYear(batch.quoted_to)}`;
}

function buildInfoText(batch) {
  const label = batch?.label || 'vigente';
  const from = formatMonthYear(batch?.quoted_from);
  const to = formatMonthYear(batch?.quoted_to);

  return [
    'Preço bruto PRO comparado ao preço bruto do concorrente.',
    `Cotações do lote ${label}, de ${from} a ${to}; atualização semestral.`,
    'Δ = PRO ÷ concorrente − 1. "PRO X% acima" = PRO mais caro; "abaixo" = mais barato.',
    'Exato: mesmo produto, embalagem e tamanho. Similar: tamanho/embalagem diferente, comparado em R$/100g ou R$/unidade. Referência: só a categoria bate, contexto sem comparação direta.',
    'Usamos a cotação do maior volume até a faixa selecionada; cotações só em volume maior ficam fora da síntese.',
    'Referência de mercado = mediana dos concorrentes Exato/Similar comparáveis.',
  ];
}

const LoadingState = () => (
  <div className="space-y-4">
    <div className="flex flex-wrap gap-2">
      <Skeleton className="h-9 w-24" />
      <Skeleton className="h-9 w-24" />
      <Skeleton className="h-9 w-24" />
    </div>
    <Skeleton className="h-20 w-full" />
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
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

  const infoItems = useMemo(() => buildInfoText(batch), [batch]);
  const headerBatchLabel = batchLabel(batch);
  const summary = comparison?.summary || null;
  const selectedProPrice = selectedTier ? pricesByTier[selectedTier] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl bg-white dark:bg-[#171717] dark:border-gray-800">
        <DialogHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="space-y-2">
              <DialogTitle className="text-gray-900 dark:text-white">{sku || 'SKU'}</DialogTitle>
              <DialogDescription className="text-gray-500 dark:text-gray-400">
                Comparativo de preços de concorrentes por faixa do Catálogo PRO.
              </DialogDescription>
              {headerBatchLabel && (
                <Badge variant="outline" className="w-fit border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-[#111111] dark:text-gray-300">
                  {headerBatchLabel}
                </Badge>
              )}
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  aria-label="Como ler"
                >
                  <Info className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[360px] border-gray-200 bg-white text-gray-700 dark:border-gray-800 dark:bg-[#111111] dark:text-gray-300">
                <div className="space-y-3 text-sm">
                  <p className="font-semibold text-gray-900 dark:text-white">Como ler</p>
                  {infoItems.map((item) => (
                    <p key={item} className="leading-6">
                      {item}
                    </p>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {tiers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Faixa</p>
              <ToggleGroup
                type="single"
                value={selectedTier}
                onValueChange={(value) => value && setSelectedTier(value)}
                variant="outline"
                className="justify-start flex-wrap"
              >
                {tiers.map((tier) => (
                  <ToggleGroupItem
                    key={tier}
                    value={String(tier)}
                    className="min-w-[72px] border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300"
                  >
                    {formatVolume(tier)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}
        </DialogHeader>

        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} />
        ) : matches.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {summary?.n >= 2 && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-[#111111] dark:text-gray-300">
                <span className="font-medium text-gray-900 dark:text-white">Preço PRO {formatCurrency(selectedProPrice)}</span>
                {' · '}
                <span>
                  Referência de mercado {formatMetric(summary.median, summary.preferredBasis)} (mediana de {summary.n})
                </span>
                {' → '}
                <span>{formatDelta(summary.deltaVsMedian)} vs mediana</span>
                {' · '}
                <span>{summary.position}º mais barato de {summary.total}</span>
              </div>
            )}

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0a0a0a] overflow-hidden">
              <div className="max-h-[60vh] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-gray-200 dark:border-gray-800">
                      <TableHead className="min-w-[150px]">Concorrente</TableHead>
                      <TableHead className="min-w-[220px]">SKU ref.</TableHead>
                      <TableHead className="min-w-[120px]">Nível</TableHead>
                      <TableHead className="min-w-[110px]">Vol. cotação</TableHead>
                      <TableHead className="min-w-[120px]">Preço bruto</TableHead>
                      <TableHead className="min-w-[130px]">Métrica</TableHead>
                      <TableHead className="min-w-[120px]">Δ</TableHead>
                      <TableHead className="min-w-[120px]">Data</TableHead>
                      <TableHead className="min-w-[220px]">Obs.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparison?.rows.map((row, index) => {
                      const badge = row.quote?.quoted_at ? getAgeBadge(row.quote.quoted_at, new Date().toISOString()) : null;
                      const notes = [row.diff_reason, row.note].filter(Boolean);

                      return (
                        <TableRow
                          key={`${row.competitor}-${row.competitor_sku}-${index}`}
                          className={cn(
                            'border-gray-200 align-top dark:border-gray-800',
                            row.outOfTier && 'opacity-60'
                          )}
                        >
                          <TableCell className="font-medium text-gray-900 dark:text-white">{row.competitor || '–'}</TableCell>
                          <TableCell className="text-gray-700 dark:text-gray-300">{row.competitor_sku || '–'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-gray-200 bg-transparent text-gray-700 dark:border-gray-700 dark:text-gray-300">
                              {levelLabel(row.match_level)}
                            </Badge>
                          </TableCell>
                          <TableCell>{row.quote?.volume != null ? `${formatVolume(row.quote.volume)} un` : '–'}</TableCell>
                          <TableCell>{row.quote ? formatCurrency(row.quote.gross_price) : '–'}</TableCell>
                          <TableCell>{formatMetric(row.mConc, row.basis)}</TableCell>
                          <TableCell className="text-gray-700 dark:text-gray-300">{row.delta == null ? '–' : formatDelta(row.delta)}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div>{row.quote?.quoted_at ? formatMonthYear(row.quote.quoted_at) : '–'}</div>
                              {badge === 'warn' && (
                                <div className="text-xs text-amber-700 dark:text-amber-300">⚠ 6-12 meses</div>
                              )}
                              {badge === 'stale' && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">desatualizada</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                              {notes.length === 0 && !row.outOfTier ? '–' : null}
                              {notes.map((note) => (
                                <div key={note}>{note}</div>
                              ))}
                              {row.outOfTier && row.quote?.volume != null && (
                                <div>cotação a partir de {formatVolume(row.quote.volume)} un, fora da síntese</div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CompetitorPricesDialog;
