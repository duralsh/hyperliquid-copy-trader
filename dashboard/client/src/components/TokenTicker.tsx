import { useTokenPrices } from "../hooks/useTokenPrices.js";
import type { TokenPrice } from "../../../shared/types.js";

function formatPrice(price: number): string {
  if (price >= 1_000) {
    return price.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  if (price >= 1) {
    return price.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (price >= 0.01) {
    return price.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  }
  return price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  });
}

function formatChange(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

function TokenItem({ token }: { token: TokenPrice }) {
  const changeColor = token.change2h >= 0 ? "text-green" : "text-red";

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-border bg-bg-tertiary px-3 py-1">
      {token.iconUrl && (
        <img
          src={token.iconUrl}
          alt={token.coin}
          className="w-3.5 h-3.5 rounded-full flex-shrink-0"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <span className="text-amber font-bold">{token.coin}</span>
      <span className="text-text tabular-nums">{formatPrice(token.price)}</span>
      <span className={`${changeColor} tabular-nums`}>
        {formatChange(token.change2h)}
      </span>
    </span>
  );
}

export function TokenTicker() {
  const { data: prices, isLoading, isError } = useTokenPrices();

  if (isLoading || isError || !prices || prices.length === 0) {
    return (
      <div className="h-10 bg-bg border-b border-border/20 shrink-0" />
    );
  }

  const renderList = (keyPrefix: string) =>
    prices.map((token) => (
      <span key={`${keyPrefix}-${token.coin}`} className="inline-flex items-center">
        <TokenItem token={token} />
      </span>
    ));

  return (
    <div
      className="h-10 bg-bg border-b border-border/20 shrink-0 overflow-hidden flex items-center ticker-track"
      aria-label="Token price ticker"
    >
      <div className="ticker-content">
        {renderList("a")}
        {renderList("b")}
      </div>
    </div>
  );
}
