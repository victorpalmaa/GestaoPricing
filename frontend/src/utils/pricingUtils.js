import { addDays, differenceInDays, isValid } from 'date-fns';

/**
 * Calcula o Gate com base no mês (0-11).
 * Gate 1: Nov(10), Dec(11), Jan(0), Feb(1) -> 1
 * Gate 2: Mar(2), Apr(3), May(4), Jun(5) -> 2
 * Gate 3: Jul(6), Aug(7), Sep(8), Oct(9) -> 3
 * @param {number} monthIndex - Mês de 0 a 11
 * @returns {number} Gate (1, 2 ou 3)
 */
export const calculateGate = (monthIndex) => {
  if (monthIndex >= 2 && monthIndex <= 5) return 2;
  if (monthIndex >= 6 && monthIndex <= 9) return 3;
  return 1;
};

/**
 * Calcula informações do contrato (Gate, Datas, Status).
 * @param {Object} contract - Objeto do contrato (deve conter 'date')
 * @returns {Object} Informações calculadas
 */
export const calculateContractInfo = (contract) => {
  const contractDateStr = contract.date;
  
  if (!contractDateStr) return { 
    gate: 0, 
    next_validity_date: null, 
    communicationDate: null, 
    daysRemaining: null,
    status: 'unknown',
    isNewContract: false
  };
  
  // Parse manually to ensure local time (avoid UTC shift)
  let contractDate;
  try {
    if (typeof contractDateStr === 'string' && contractDateStr.includes('-')) {
      const [year, month, day] = contractDateStr.split('-').map(Number);
      contractDate = new Date(year, month - 1, day);
    } else {
      contractDate = new Date(contractDateStr);
    }
  } catch (e) {
    contractDate = new Date(NaN);
  }

  if (!isValid(contractDate)) return {
    gate: 0, 
    next_validity_date: null, 
    communicationDate: null, 
    daysRemaining: null,
    status: 'error',
    isNewContract: false
  };

  const month = contractDate.getMonth(); // 0-11
  // Use gate from DB if available, otherwise calculate
  const gate = contract.gate ? Number(contract.gate) : calculateGate(month);
  
  // Calculate Next Validity (Anniversary in Current/Next Year)
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize today
  
  const currentYear = today.getFullYear();
  let nextValidity;
  if (contractDate >= today) {
    nextValidity = new Date(contractDate.getFullYear(), month, contractDate.getDate());
  } else {
    nextValidity = new Date(currentYear, month, contractDate.getDate());
    if (nextValidity < today) {
      nextValidity = new Date(currentYear + 1, month, contractDate.getDate());
    }
  }
  
  const communicationDate = addDays(nextValidity, -30);
  const daysRemaining = differenceInDays(communicationDate, today);
  
  // Regra de Carência: Contratos com menos de 90 dias
  const isNewContract = differenceInDays(today, contractDate) < 90;

  let status = 'normal';
  // Só é crítico se:
  // 1. Faltam 30 dias ou menos
  // 2. NÃO é um contrato novo (carência)
  // 3. NÃO foi comunicado ainda
  if (daysRemaining <= 30 && !isNewContract && contract.communication_status !== 'communicated') {
    status = 'critical';
  }
  
  return {
     gate,
     next_validity_date: nextValidity.toISOString(),
     communicationDate,
     daysRemaining,
     status,
     isNewContract
  };
};

export const WORKFLOW_STATUS_OPTIONS = [
  { value: 'Em Análise', label: 'Em Análise', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700' },
  { value: 'Comunicado', label: 'Comunicado', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800' },
  { value: 'Em Negociação', label: 'Em Negociação', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
  { value: 'Aprovado', label: 'Aprovado', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800' },
  { value: 'Implementado', label: 'Implementado', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800' }
];

export const filterChangedHistoryPoints = (rows, options = {}) => {
  const {
    dateField = 'date',
    priceField = 'gross_price',
    marginField = 'margin_budget',
    epsilon = 0.0001
  } = options;

  const parseDate = (value) => {
    if (!value) return null;
    const parsed = value instanceof Date
      ? new Date(value.getTime())
      : new Date(value.toString().includes('T') ? value : `${value}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const sortedRows = [...(rows || [])].sort((a, b) => {
    const aTime = parseDate(a?.[dateField])?.getTime() || 0;
    const bTime = parseDate(b?.[dateField])?.getTime() || 0;
    return aTime - bTime;
  });

  const changedRows = [];
  let lastPrice = null;
  let lastMargin = null;

  sortedRows.forEach((row) => {
    const price = Number(row?.[priceField] || 0);
    const margin = Number(row?.[marginField] || 0);

    if (changedRows.length === 0) {
      changedRows.push(row);
      lastPrice = price;
      lastMargin = margin;
      return;
    }

    const priceChanged = Math.abs(price - lastPrice) > epsilon;
    const marginChanged = Math.abs(margin - lastMargin) > epsilon;

    if (priceChanged || marginChanged) {
      changedRows.push(row);
      lastPrice = price;
      lastMargin = margin;
    }
  });

  return changedRows;
};
