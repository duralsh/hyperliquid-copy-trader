import { useRef, useEffect } from "react";
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
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-border/60 bg-bg-tertiary px-3 py-1 transition-all duration-200 hover:border-border"
    >
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

function ScrollingTicker({ prices }: { prices: TokenPrice[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    let rafId = 0;
    let accum = 0;

    const tick = () => {
      if (!hovering.current) {
        accum += 0.5;
        if (accum >= 1) {
          const px = Math.floor(accum);
          accum -= px;
          el.scrollLeft += px;
          if (el.scrollWidth > 0 && el.scrollLeft >= el.scrollWidth / 2) {
            el.scrollLeft -= el.scrollWidth / 2;
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      el.scrollLeft += e.deltaY + e.deltaX;
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(rafId);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  return (
    <div
      ref={trackRef}
      onMouseEnter={() => { hovering.current = true; }}
      onMouseLeave={() => { hovering.current = false; }}
      className="h-10 bg-bg border-b border-border/20 shrink-0 flex items-center gap-3 px-4 ticker-track"
      style={{ overflowX: "scroll", overflowY: "hidden", scrollbarWidth: "none", width: "100%", maxWidth: "100vw" }}
      aria-label="Token price ticker"
    >
      {[0, 1].map((copy) =>
        prices.map((token) => (
          <span key={`${copy}-${token.coin}`} className="inline-flex items-center shrink-0">
            <TokenItem token={token} />
          </span>
        ))
      )}
    </div>
  );
}

export function TokenTicker() {
  const { data: prices, isLoading, isError } = useTokenPrices();

  if (isLoading || isError || !prices || prices.length === 0) {
    return (
      <div className="h-10 bg-bg border-b border-border/20 shrink-0" />
    );
  }

  return <ScrollingTicker prices={prices} />;
}
