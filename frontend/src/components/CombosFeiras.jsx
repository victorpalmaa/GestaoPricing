import React from 'react';
import Header from './Header';

const comboOffers = [
  {
    id: 'Combo 1',
    title: 'Combo GLP-1',
    products: [
      'Hydra Plus Sticks - 1.500 unidades',
      'Gel Carbo - 1.000 unidades',
      'Chá com Gaba - 1.000 unidades',
    ],
    prices: ['Preço do combo: R$ 97.990'],
    conditions: ['Desconto de 18%'],
  },
  {
    id: 'Combo 2',
    title: 'Combo Endurance',
    products: [
      'Hydra Plus Sticks - 1.500 unidades',
      'Gel Carbo - 1.000 unidades',
      'Gel Caf + Tau - 1.000 unidades',
    ],
    prices: ['Preço do combo: R$ 95.990'],
    conditions: ['Desconto de 20%'],
  },
  {
    id: 'Combo 3',
    title: 'Combo Best Sellers',
    products: [
      'Creatina - 3.000 unidades',
      'Pré Treino - 2.000 unidades',
      'Colágeno Hidrolisado - 1.000 unidades',
    ],
    prices: ['Preço do combo: R$ 149.990'],
    conditions: ['Desconto de 12%'],
  },
  {
    id: 'Combo 4',
    title: 'Combo Hydra Plus',
    products: ['Hydra Plus - 3.000 unidades'],
    flavors: ['Melancia com Limão', 'Maçã Verde', 'Abacaxi'],
    prices: ['Preço do combo: R$ 76.990'],
    conditions: ['Desconto de 16%'],
  },
  {
    id: 'Combo 5',
    title: 'Promoção Creatina',
    products: ['Creatina pote 300g - 3.000 unidades'],
    prices: ['Preço do combo: R$ 63.240'],
    conditions: ['Desconto de 7%'],
  },
  {
    id: 'Combo 6',
    title: 'Promoção Creatina',
    products: ['Creatina pote 300g - 5.000 unidades'],
    prices: ['Preço do combo: R$ 95.200'],
    conditions: ['Desconto de 9%'],
  },
  {
    id: 'Combo 7',
    title: 'Gel de Maçã Verde',
    products: ['Gel de maçã verde (carbo simples ou caf + tau)'],
    productNoteLabel: 'Condição',
    productNote: 'Volume mínimo de 2.000 unidades',
    prices: [
      'Preço do display: R$ 22,99',
      'Preço 2.000 unidades: R$ 45.980',
      'Preço 3.000 unidades: R$ 68.970',
    ],
    conditions: ['Desconto de 37%'],
  },
];

const CombosFeiras = ({ user }) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-200">
      <Header
        user={user}
        title="Combos Feiras 2026"
        subtitle="Consulta de condições comerciais"
        showBack
        backPath="/select"
      />

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
            Combos Feiras 2026
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Consulte os combos, preços e condições disponíveis para negociações durante as feiras.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {comboOffers.map((combo) => (
            <div
              key={combo.id}
              className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-white dark:bg-[#0a0a0a] shadow-sm p-6"
            >
              <div className="mb-4">
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {combo.id}
                </p>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-1">
                  {combo.title}
                </h2>
              </div>

              <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Produtos</p>
                  <div className="mt-2 space-y-1">
                    {combo.products.map((product) => (
                      <div
                        key={product}
                        className={`rounded-lg bg-gray-50 dark:bg-gray-900/70 px-3 py-2 ${
                          combo.id === 'Combo 7' ? 'text-[13px] lg:text-[12.5px] xl:whitespace-nowrap' : ''
                        }`}
                      >
                        {product}
                      </div>
                    ))}
                  </div>
                  {combo.productNote ? (
                    <div className="mt-3">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {combo.productNoteLabel || 'Condição'}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-blue-50 dark:bg-blue-900/20 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                          {combo.productNote}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>

                {combo.flavors?.length ? (
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Sabores</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {combo.flavors.map((flavor) => (
                        <span
                          key={flavor}
                          className="rounded-full bg-blue-50 dark:bg-blue-900/20 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300"
                        >
                          {flavor}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Preços</p>
                  <div className="mt-3 space-y-2">
                    {combo.prices.map((price) => (
                      <div
                        key={price}
                        className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-900/20 dark:to-emerald-900/5 px-4 py-3 text-base font-semibold tracking-tight text-emerald-800 shadow-sm dark:text-emerald-200"
                      >
                        {price}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mt-2 space-y-1">
                    {combo.conditions.map((condition) => (
                      <div
                        key={condition}
                        className="rounded-lg border border-[#845AFA]/20 bg-[#845AFA]/5 px-3 py-2 text-[#6b46c1] dark:border-purple-900/30 dark:bg-purple-900/10 dark:text-purple-300"
                      >
                        {condition}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold text-gray-900 dark:text-white">Obs:</span> As
            negociações dos combos devem ser fechadas durante as feiras, com prazo máximo de até
            5 dias pós-feiras.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CombosFeiras;
