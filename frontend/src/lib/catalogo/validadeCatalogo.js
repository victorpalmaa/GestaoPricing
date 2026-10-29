import { differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';

function toDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return parseISO(value);
  return new Date(value);
}

export function getValidadeCatalogo(today, expiryDate) {
  const normalizedToday = startOfDay(toDate(today));
  const normalizedExpiryDate = startOfDay(toDate(expiryDate));
  const days = differenceInCalendarDays(normalizedExpiryDate, normalizedToday);
  const expiryDateText = format(normalizedExpiryDate, 'dd/MM/yyyy');

  if (days > 30) {
    return {
      days,
      phase: 'vigente',
      description: `Os preços deste catálogo são válidos até ${expiryDateText}.`,
    };
  }

  if (days >= 0) {
    if (days >= 2) {
      return {
        days,
        phase: 'aviso',
        description: `Faltam ${days} dias para o vencimento dos preços deste catálogo (${expiryDateText}).`,
      };
    }

    if (days === 1) {
      return {
        days,
        phase: 'aviso',
        description: `Falta 1 dia para o vencimento dos preços deste catálogo (${expiryDateText}).`,
      };
    }

    return {
      days,
      phase: 'aviso',
      description: `Os preços deste catálogo vencem hoje (${expiryDateText}).`,
    };
  }

  return {
    days,
    phase: 'vencido',
    description: `A validade dos preços foi encerrada em ${expiryDateText}. Para atualização, acesse o time de Data. O catálogo continua disponível para consulta.`,
  };
}
