import React from 'react';
import Header from './Header';
import ComboCard from './ComboCard';

// Desconto 15,2% = 72.990 / 86.103 - 1
// Base catálogo: Hydra Plus Sticks display com 14 @1.500 = 33,65
// e Creatina pote 300g @1.000 = 23,75 (não há tier de 1.500;
// aplica-se a faixa anterior). Fonte: catalog_br_prices.
const COMBOS = [
  {
    id: 'eletrolitos-creatina',
    title: 'Combo eletrólitos + creatina',
    subtitle: 'Aprovado set/26',
    items: [
      {
        name: 'Hydra Plus Sticks',
        id: '01198-006',
        unitPrice: 29.05,
        quantity: 1500,
        markerColor: '#35BCFF',
      },
      {
        name: 'Creatina - pote 300g',
        id: '01198-005',
        unitPrice: 19.61,
        quantity: 1500,
        markerColor: 'var(--color-primary)',
      },
    ],
    flavors: [
      'Melancia e limão',
      'Maçã verde',
      'Abacaxi',
    ],
    totalVolume: 3000,
    discountPercent: 15.2,
    totalValue: 72990,
  },
];

const Combos2026 = ({ user }) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-200">
      <Header
        user={user}
        title="Combos 2026"
        subtitle="Combos aprovados"
        showBack={false}
        logoRedirect="/select"
      />

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div style={{ marginBottom: '14px' }}>
          <h1
            className="text-gray-900 dark:text-white"
            style={{
              fontSize: '34px',
              fontWeight: 600,
              letterSpacing: '-0.6px',
              lineHeight: 1.15,
            }}
          >
            Combos 2026
          </h1>
          <p
            className="text-gray-600 dark:text-gray-400"
            style={{ fontSize: '16px', marginTop: '2px' }}
          >
            Combos comerciais aprovados para o ano de 2026.
          </p>
        </div>

        <div className="space-y-6">
          {COMBOS.map((combo) => (
            <ComboCard key={combo.id} combo={combo} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Combos2026;
