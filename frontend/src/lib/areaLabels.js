export const AREA_LABELS = {
  'Pricing': 'Data',
  'CS': 'Business Development',
  'Pré-vendas': 'New Business',
};

export function getAreaLabel(area) {
  return AREA_LABELS[area] ?? area ?? '';
}
