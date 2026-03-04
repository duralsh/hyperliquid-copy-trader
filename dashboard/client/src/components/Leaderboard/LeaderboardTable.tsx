import { useState, useRef, useCallback, useEffect } from "react";
import { useLeaderboard } from "../../hooks/useLeaderboard.js";
import { useSmartFilter } from "../../hooks/useSmartFilter.js";
import { useAuth } from "../../hooks/useAuth.js";
import { formatUSD, formatPnl, formatRoi, formatVolume, shortenAddress } from "../../utils/format.js";
import { CopyButton } from "../CopyButton.js";
import { StarButton } from "../StarButton.js";
import { FavoritesSection } from "./FavoritesSection.js";
import type { TimeWindow, SortField, TraderSummary } from "../../../../shared/types.js";

interface Props {
  onSelectTrader: (trader: TraderSummary | null) => void;
  selectedAddress?: string;
  favoriteTraders: TraderSummary[];
  isFavorite: (address: string) => boolean;
  toggleFavorite: (address: string, trader?: TraderSummary) => void;
  refreshFavorites: (traders: TraderSummary[]) => void;
}

const WINDOWS: { key: TimeWindow; label: string }[] = [
  { key: "day", label: "1D" },
  { key: "week", label: "1W" },
  { key: "month", label: "1M" },
  { key: "allTime", label: "ALL" },
];

type ColumnKey = SortField | "rank" | "trader";

const COLUMNS: { key: ColumnKey; label: string; sortable: boolean; sortField?: SortField; align: "left" | "right" }[] = [
  { key: "rank", label: "#", sortable: false, align: "left" },
  { key: "trader", label: "TRADER", sortable: false, align: "left" },
  { key: "accountValue", label: "ACCOUNT", sortable: true, sortField: "accountValue", align: "right" },
  { key: "pnl", label: "PNL", sortable: true, sortField: "pnl", align: "right" },
  { key: "roi", label: "ROI", sortable: true, sortField: "roi", align: "right" },
  { key: "volume", label: "VOLUME", sortable: true, sortField: "volume", align: "right" },
];

const SMART_COLUMNS: { key: string; label: string; align: "left" | "right" }[] = [
  { key: "rank", label: "#", align: "left" },
  { key: "trader", label: "TRADER", align: "left" },
  { key: "account", label: "ACCOUNT", align: "right" },
  { key: "roi", label: "ROI 30D", align: "right" },
  { key: "pnl", label: "PNL 30D", align: "right" },
  { key: "ratio", label: "RATIO", align: "right" },
  { key: "vol24h", label: "24H VOL", align: "right" },
];

export function LeaderboardTable({ onSelectTrader, selectedAddress, favoriteTraders, isFavorite, toggleFavorite, refreshFavorites }: Props) {
  const { isAuthenticated } = useAuth();
  const [window, setWindow] = useState<TimeWindow>("month");
  const [sort, setSort] = useState<SortField>("pnl");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [minAcct, setMinAcct] = useState("");
  const [maxAcct, setMaxAcct] = useState("");
  const [filterText, setFilterText] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [smartFilterOn, setSmartFilterOn] = useState(false);

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useLeaderboard({
    window,
    sort,
    order,
    minAccountValue: minAcct ? parseFloat(minAcct) : undefined,
    maxAccountValue: maxAcct ? parseFloat(maxAcct) : undefined,
  });

  const {
    data: smartFilterData,
    isLoading: smartFilterLoading,
    error: smartFilterError,
  } = useSmartFilter(smartFilterOn);

  const allTraders = data?.pages.flatMap((p) => p.traders) ?? [];
  const totalCount = data?.pages[0]?.total ?? 0;

  // Filter by name/address
  const filteredTraders = filterText
    ? allTraders.filter(
        (t) =>
          (t.displayName ?? "").toLowerCase().includes(filterText.toLowerCase()) ||
          t.address.toLowerCase().includes(filterText.toLowerCase())
      )
    : allTraders;

  const toggleSort = (field: SortField) => {
    if (sort === field) {
      setOrder((o) => (o === "desc" ? "asc" : "desc"));
    } else {
      setSort(field);
      setOrder("desc");
    }
  };

  // Infinite scroll observer
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        },
        { threshold: 0.1 }
      );
      observerRef.current.observe(node);
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  // Cleanup observer
  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  // Update stored favorites with fresh data when API responses arrive
  useEffect(() => {
    const traders: TraderSummary[] = [];
    if (allTraders.length) traders.push(...allTraders);
    if (smartFilterData?.eligible) traders.push(...smartFilterData.eligible.map((r) => r.trader));
    if (traders.length) refreshFavorites(traders);
  }, [allTraders, smartFilterData, refreshFavorites]);

  const showSmartView = smartFilterOn && smartFilterData && !smartFilterLoading;

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Title row */}
      <div className="flex items-center gap-4 px-4 py-3 shrink-0 flex-wrap">
        <span className="text-green text-sm font-bold tracking-wider">LEADERBOARD</span>

        {/* Time window selector — hidden when smart filter is active */}
        {!smartFilterOn && (
          <div className="flex gap-1">
            {WINDOWS.map((w) => (
              <button
                key={w.key}
                onClick={() => setWindow(w.key)}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${
                  window === w.key
                    ? "bg-green/15 text-green border border-green/40"
                    : "text-text-dim hover:text-text border border-transparent"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        )}

        {/* Search input */}
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="search trader..."
          className="w-36 bg-bg border border-border rounded px-2 py-1 text-text text-xs focus:border-green focus:outline-none"
        />

        {/* Filters toggle — hidden when smart filter is active */}
        {!smartFilterOn && (
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={`text-xs px-2 py-1 transition-colors ${
              filtersOpen || minAcct || maxAcct
                ? "text-amber"
                : "text-text-dim hover:text-text"
            }`}
          >
            {filtersOpen ? "- filters" : "+ filters"}
          </button>
        )}

        {/* Smart Filter toggle */}
        <button
          onClick={() => setSmartFilterOn((v) => !v)}
          className={`text-xs px-3 py-1 rounded border transition-colors flex items-center gap-1.5 ${
            smartFilterOn
              ? "bg-green/15 text-green border-green/40"
              : "text-text-dim hover:text-amber border-border hover:border-amber/40"
          }`}
        >
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              smartFilterOn ? "bg-green" : "bg-text-dim"
            }`}
          />
          SMART FILTER{smartFilterOn && smartFilterLoading && (
            <span className="cursor-blink">_</span>
          )}
        </button>

        {/* Trader count */}
        <span className="text-text-dim text-xs ml-auto tabular-nums">
          {showSmartView
            ? `${smartFilterData.eligible.length} eligible`
            : `${filteredTraders.length}/${totalCount}`}
        </span>
      </div>

      {/* Stats banner when smart filter is active */}
      {smartFilterOn && smartFilterData && (
        <div className="flex items-center gap-4 px-4 pb-2 text-xs shrink-0 flex-wrap">
          <span className="text-amber tabular-nums">
            EQUITY: {formatUSD(smartFilterData.userEquity)}
          </span>
          <span className="text-text-dim">|</span>
          <span className="text-text-dim tabular-nums">
            POOL: <span className="text-text">{smartFilterData.stats.total}</span>
          </span>
          <span className="text-text-dim">|</span>
          <span className="text-text-dim tabular-nums">
            SIZE: <span className="text-text">{smartFilterData.stats.afterSize}</span>
          </span>
          <span className="text-text-dim">|</span>
          <span className="text-text-dim tabular-nums">
            ACTIVE: <span className="text-text">{smartFilterData.stats.afterActivity}</span>
          </span>
          <span className="text-text-dim">|</span>
          <span className="text-text-dim tabular-nums">
            ELIGIBLE: <span className="text-green">{smartFilterData.stats.afterPerformance}</span>
          </span>
        </div>
      )}

      {/* Collapsible advanced filters — hidden when smart filter is active */}
      {!smartFilterOn && filtersOpen && (
        <div className="flex items-center gap-3 px-4 pb-3 text-xs shrink-0">
          <span className="text-text-dim">min$</span>
          <input
            type="number"
            value={minAcct}
            onChange={(e) => setMinAcct(e.target.value)}
            placeholder="0"
            className="w-24 bg-bg border border-border rounded px-2 py-1 text-text text-xs focus:border-green focus:outline-none"
          />
          <span className="text-text-dim">max$</span>
          <input
            type="number"
            value={maxAcct}
            onChange={(e) => setMaxAcct(e.target.value)}
            placeholder="---"
            className="w-24 bg-bg border border-border rounded px-2 py-1 text-text text-xs focus:border-green focus:outline-none"
          />
          {(minAcct || maxAcct) && (
            <button
              onClick={() => { setMinAcct(""); setMaxAcct(""); }}
              className="text-text-dim hover:text-red text-xs transition-colors"
            >
              clear
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div
        className="flex-1 overflow-auto px-4 pb-4"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("tr")) return;
          onSelectTrader(null);
        }}
      >
        {/* Smart filter loading state */}
        {smartFilterOn && smartFilterLoading && (
          <div className="text-green text-center py-8 text-sm">
            Running smart filter analysis<span className="cursor-blink">_</span>
          </div>
        )}

        {/* Smart filter error state */}
        {smartFilterOn && smartFilterError && (
          <div className="text-red text-center py-8 text-sm">
            ERR: {(smartFilterError as Error).message}
          </div>
        )}

        {/* Normal loading state */}
        {!smartFilterOn && isLoading && !data && (
          <div className="text-green text-center py-8 text-sm">
            Loading leaderboard data<span className="cursor-blink">_</span>
          </div>
        )}

        {!smartFilterOn && error && (
          <div className="text-red text-center py-8 text-sm">
            ERR: {(error as Error).message}
          </div>
        )}

        {/* === FAVORITES SECTION (always visible) === */}
        {favoriteTraders.length > 0 && (
          <FavoritesSection
            traders={favoriteTraders}
            window={window}
            toggleFavorite={toggleFavorite}
            onSelectTrader={onSelectTrader}
            selectedAddress={selectedAddress}
          />
        )}

        {/* === SMART FILTER TABLE === */}
        {showSmartView && (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-bg z-10">
              <tr className="text-text-dim border-b border-border">
                {SMART_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`${col.align === "right" ? "text-right" : "text-left"} py-2.5 px-2 text-xs font-bold tracking-wider uppercase ${
                      col.key === "rank" ? "w-10" : ""
                    } ${col.key === "vol24h" ? "pr-6" : ""}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {smartFilterData.eligible
                .filter(
                  (r) =>
                    !filterText ||
                    (r.trader.displayName ?? "").toLowerCase().includes(filterText.toLowerCase()) ||
                    r.trader.address.toLowerCase().includes(filterText.toLowerCase())
                )
                .map((result, idx) => (
                  <tr
                    key={result.trader.address}
                    onClick={() => onSelectTrader(result.trader)}
                    className={`row-hover-accent cursor-pointer transition-colors ${
                      selectedAddress === result.trader.address
                        ? "bg-green/20 border-l-[3px] border-l-green shadow-[inset_0_0_12px_rgba(0,255,65,0.08)]"
                        : idx % 2 === 0 ? "row-even" : "row-odd"
                    }`}
                    style={{ minHeight: "40px" }}
                  >
                    <td className="py-2.5 px-2 text-text-dim tabular-nums text-sm">{idx + 1}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-1">
                        <StarButton active={isFavorite(result.trader.address)} onClick={() => isAuthenticated ? toggleFavorite(result.trader.address, result.trader) : undefined} />
                        <span className="text-amber text-sm">
                          {result.trader.displayName || shortenAddress(result.trader.address)}
                        </span>
                        {result.trader.displayName && (
                          <span className="text-text-dim text-xs ml-1">
                            {shortenAddress(result.trader.address)}
                          </span>
                        )}
                        <CopyButton text={result.trader.address} />
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-sm">
                      {formatUSD(result.trader.accountValue)}
                    </td>
                    <td className={`py-2.5 px-2 text-right tabular-nums text-sm ${
                      result.roi30d >= 50 ? "text-green" : result.roi30d >= 10 ? "text-amber" : "text-text"
                    }`}>
                      {result.roi30d >= 0 ? "+" : ""}{result.roi30d.toFixed(1)}%
                    </td>
                    <td className={`py-2.5 px-2 text-right tabular-nums text-sm ${
                      result.pnl30d >= 0 ? "text-green" : "text-red"
                    }`}>
                      {formatPnl(result.pnl30d)}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-sm text-text-dim">
                      {result.equityRatio.toFixed(2)}x
                    </td>
                    <td className="py-2.5 pr-6 pl-2 text-right tabular-nums text-sm text-text-dim">
                      {formatVolume(result.trader.volume.day)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {showSmartView && smartFilterData.eligible.length === 0 && (
          <div className="py-8 text-center text-text-dim text-sm">
            No traders passed all filter criteria.
          </div>
        )}

        {/* === NORMAL LEADERBOARD TABLE === */}
        {!smartFilterOn && data && (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-bg z-10">
              <tr className="text-text-dim border-b border-border">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`${col.align === "right" ? "text-right" : "text-left"} py-2.5 px-2 text-xs font-bold tracking-wider uppercase ${
                      col.sortable ? "cursor-pointer select-none hover:text-amber transition-colors" : ""
                    } ${col.key === "rank" ? "w-10" : ""} ${col.key === "volume" ? "pr-6" : ""}`}
                    onClick={() => {
                      if (col.sortable && col.sortField) toggleSort(col.sortField);
                    }}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.sortable && col.sortField && sort === col.sortField && (
                        <span className="text-amber text-[10px]">{order === "desc" ? "DESC" : "ASC"}</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTraders.map((t, idx) => (
                <tr
                  key={t.address}
                  onClick={() => onSelectTrader(t)}
                  className={`row-hover-accent cursor-pointer transition-colors ${
                    selectedAddress === t.address
                      ? "bg-green/20 border-l-[3px] border-l-green shadow-[inset_0_0_12px_rgba(0,255,65,0.08)]"
                      : idx % 2 === 0 ? "row-even" : "row-odd"
                  }`}
                  style={{ minHeight: "40px" }}
                >
                  <td className="py-2.5 px-2 text-text-dim tabular-nums text-sm">{t.rank}</td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-1">
                      <StarButton active={isFavorite(t.address)} onClick={() => isAuthenticated ? toggleFavorite(t.address, t) : undefined} />
                      <span className="text-amber text-sm">{t.displayName || shortenAddress(t.address)}</span>
                      {t.displayName && (
                        <span className="text-text-dim text-xs ml-1">{shortenAddress(t.address)}</span>
                      )}
                      <CopyButton text={t.address} />
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-sm">{formatUSD(t.accountValue)}</td>
                  <td className={`py-2.5 px-2 text-right tabular-nums text-sm ${t.pnl[window] >= 0 ? "text-green" : "text-red"}`}>
                    {formatPnl(t.pnl[window])}
                  </td>
                  <td className={`py-2.5 px-2 text-right tabular-nums text-sm ${t.roi[window] >= 0 ? "text-green" : "text-red"}`}>
                    {formatRoi(t.roi[window])}
                  </td>
                  <td className="py-2.5 pr-6 pl-2 text-right tabular-nums text-sm text-text-dim">
                    {formatVolume(t.volume[window])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* No results when filtering */}
        {!smartFilterOn && data && filterText && filteredTraders.length === 0 && (
          <div className="py-8 text-center text-text-dim text-sm">
            No traders matching "{filterText}"
          </div>
        )}

        {/* Infinite scroll trigger — only when smart filter is off AND not filtering */}
        {!smartFilterOn && !filterText && hasNextPage && (
          <div ref={loadMoreRef} className="py-4 text-center">
            {isFetchingNextPage ? (
              <span className="text-green text-xs">
                Loading more traders<span className="cursor-blink">_</span>
              </span>
            ) : (
              <span className="text-text-dim text-xs">scroll for more...</span>
            )}
          </div>
        )}

        {!smartFilterOn && data && !filterText && !hasNextPage && filteredTraders.length > 0 && (
          <div className="py-3 text-center text-text-dim text-xs">
            -- end of leaderboard ({totalCount} traders) --
          </div>
        )}
      </div>
    </div>
  );
}
