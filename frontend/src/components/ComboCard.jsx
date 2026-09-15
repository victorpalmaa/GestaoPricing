import React from 'react';

const formatCurrency = (value, decimals = 2) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const formatQuantity = (value) => value.toLocaleString('pt-BR');

const statusBadgeStyle = {
  backgroundColor: '#E8F6DF',
  color: '#226F0A',
  fontSize: '13px',
  fontWeight: 500,
  padding: '6px 13px',
  borderRadius: '20px',
  lineHeight: 1,
};

const flavorChipStyle = {
  backgroundColor: '#E6F6FE',
  color: '#12658B',
  fontSize: '13.5px',
  padding: '5px 13px',
  borderRadius: '20px',
  lineHeight: 1.2,
};

const ComboCard = ({ combo }) => {
  const { title, subtitle, items, flavors, totalVolume, discountPercent, totalValue } = combo;

  const totalSkus = items.length;
  const totalUnits = items.reduce((acc, it) => acc + (it.quantity || 0), 0);

  return (
    <div
      className="w-full bg-white dark:bg-[#111111] overflow-hidden border border-[color:var(--color-border)]"
      style={{ borderRadius: '12px' }}
    >
      <div
        className="w-full"
        style={{
          height: '4px',
          backgroundColor: 'var(--color-primary)',
        }}
      />

      <div
        className="flex items-center justify-between flex-wrap gap-3"
        style={{ padding: '13px 20px 10px' }}
      >
        <div>
          <h2
            style={{
              fontSize: '21.5px',
              fontWeight: 600,
              lineHeight: 1.2,
              color: 'var(--color-text-primary)',
            }}
          >
            {title}
          </h2>
          <p
            style={{
              fontSize: '13.5px',
              fontWeight: 400,
              color: 'var(--color-text-secondary)',
              marginTop: '1px',
            }}
          >
            {totalSkus} SKUs · {formatQuantity(totalUnits)} un
          </p>
        </div>
        <span style={statusBadgeStyle}>{subtitle}</span>
      </div>

      <div style={{ padding: '0 20px' }}>
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center"
            style={{
              padding: '9px 0',
              gap: '12px',
              borderTop: idx === 0 ? '0.5px solid var(--color-border)' : 'none',
              borderBottom: idx === items.length - 1 ? '0.5px solid var(--color-border)' : '0.5px solid var(--color-border)',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '32px',
                borderRadius: '3px',
                backgroundColor: item.markerColor || 'var(--color-primary)',
                flexShrink: 0,
                display: 'inline-block',
              }}
            />
            <div className="flex-1 min-w-0">
              <p
                style={{
                  fontSize: '16.5px',
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                  lineHeight: 1.25,
                }}
              >
                {item.name}
              </p>
              <p
                style={{
                  fontFamily:
                    'source-code-pro, Menlo, Monaco, Consolas, "Courier New", monospace',
                  fontSize: '13px',
                  color: 'var(--color-text-muted)',
                  marginTop: '0px',
                }}
              >
                {item.id}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p
                style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.2,
                }}
              >
                {formatCurrency(item.unitPrice, 2)}
              </p>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--color-text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                  marginTop: '0px',
                }}
              >
                {formatQuantity(item.quantity)} un
              </p>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: '11px 20px 12px',
          borderTop: '0.5px solid var(--color-border)',
        }}
        className="flex flex-wrap items-center"
      >
        <span
          style={{
            fontSize: '13.5px',
            color: 'var(--color-text-secondary)',
            marginRight: '8px',
          }}
        >
          Sabores
        </span>
        <div className="flex flex-wrap" style={{ gap: '8px' }}>
          {flavors.map((flavor) => (
            <span key={flavor} style={flavorChipStyle}>
              {flavor}
            </span>
          ))}
        </div>
      </div>

      <div
        className="flex items-end justify-between flex-wrap"
        style={{
          backgroundColor: '#5A3FA8',
          padding: '14px 20px 15px',
          gap: '18px',
        }}
      >
        <div>
          <p style={{ fontSize: '14px', color: '#E0D9F7' }}>Valor total</p>
          <p
            style={{
              fontSize: '46px',
              fontWeight: 600,
              letterSpacing: '-1.2px',
              color: '#FFFFFF',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.02,
              marginTop: '0px',
            }}
          >
            {formatCurrency(totalValue, 0)}
          </p>
        </div>
        <div>
          <p style={{ fontSize: '14px', color: '#E0D9F7' }}>
            Desconto vs. catálogo
          </p>
          <p
            style={{
              fontSize: '46px',
              fontWeight: 600,
              letterSpacing: '-1.2px',
              color: 'var(--color-success)',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.02,
              marginTop: '0px',
            }}
          >
            {discountPercent.toLocaleString('pt-BR', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}
            %
          </p>
        </div>
        <div style={{ paddingBottom: '5px' }}>
          <p style={{ fontSize: '14px', color: '#E0D9F7' }}>Volume total</p>
          <p
            style={{
              fontSize: '23px',
              fontWeight: 500,
              color: '#FFFFFF',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.2,
              marginTop: '0px',
            }}
          >
            {formatQuantity(totalVolume)} un
          </p>
        </div>
      </div>
    </div>
  );
};

export default ComboCard;
