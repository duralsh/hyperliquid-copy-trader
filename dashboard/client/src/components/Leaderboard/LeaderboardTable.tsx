import { useState, useRef, useCallback, useEffect } from "react";
import { useLeaderboard } from "../../hooks/useLeaderboard.js";
import { formatUSD, formatPnl, formatRoi, formatVolume, shortenAddress } from "../../utils/format.js";
import type { TimeWindow, SortField, TraderSummary } from "../../../../shared/types.js";

interface Props {
  onSelectTrader: (trader: TraderSummary) => void;
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

export function LeaderboardTable({ onSelectTrader }: Props) {
  const [window, setWindow] = useState<TimeWindow>("month");
  const [sort, setSort] = useState<SortField>("pnl");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [minAcct, setMinAcct] = useState("");
  const [maxAcct, setMaxAcct] = useState("");
  const [filterText, setFilterText] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Title row — compact: title + time windows + search + count */}
      <div className="flex items-center gap-4 px-4 py-3 shrink-0 flex-wrap">
        <span className="text-green text-sm font-bold tracking-wider">LEADERBOARD</span>

        {/* Time window selector */}
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

        {/* Search input */}
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="search trader..."
          className="w-36 bg-bg border border-border rounded px-2 py-1 text-text text-xs focus:border-green focus:outline-none"
        />

        {/* Filters toggle */}
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

        {/* Trader count */}
        <span className="text-text-dim text-xs ml-auto tabular-nums">
          {filteredTraders.length}/{totalCount}
        </span>
      </div>

      {/* Collapsible advanced filters */}
      {filtersOpen && (
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
      <div className="flex-1 overflow-auto px-4 pb-4">
        {isLoading && !data && (
          <div className="text-green text-center py-8 text-sm">
            <span className="cursor-blink">_</span> Loading leaderboard data...
          </div>
        )}

        {error && (
          <div className="text-red text-center py-8 text-sm">
            ERR: {(error as Error).message}
          </div>
        )}

        {data && (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-bg z-10">
              <tr className="text-text-dim border-b border-border">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`${col.align === "right" ? "text-right" : "text-left"} py-2.5 px-2 text-xs font-bold tracking-wider uppercase ${
                      col.sortable ? "cursor-pointer select-none hover:text-amber transition-colors" : ""
                    } ${col.key === "rank" ? "w-10" : ""}`}
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
                    idx % 2 === 0 ? "row-even" : "row-odd"
                  }`}
                  style={{ minHeight: "40px" }}
                >
                  <td className="py-2.5 px-2 text-text-dim tabular-nums text-sm">{t.rank}</td>
                  <td className="py-2.5 px-2">
                    <span className="text-amber text-sm">{t.displayName || shortenAddress(t.address)}</span>
                    {t.displayName && (
                      <span className="text-text-dim text-xs ml-2">{shortenAddress(t.address)}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-sm">{formatUSD(t.accountValue)}</td>
                  <td className={`py-2.5 px-2 text-right tabular-nums text-sm ${t.pnl[window] >= 0 ? "text-green" : "text-red"}`}>
                    {formatPnl(t.pnl[window])}
                  </td>
                  <td className={`py-2.5 px-2 text-right tabular-nums text-sm ${t.roi[window] >= 0 ? "text-green" : "text-red"}`}>
                    {formatRoi(t.roi[window])}
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-sm text-text-dim">
                    {formatVolume(t.volume[window])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Infinite scroll trigger */}
        {hasNextPage && (
          <div ref={loadMoreRef} className="py-4 text-center">
            {isFetchingNextPage ? (
              <span className="text-green text-xs">
                <span className="cursor-blink">_</span> Loading more traders...
              </span>
            ) : (
              <span className="text-text-dim text-xs">scroll for more...</span>
            )}
          </div>
        )}

        {data && !hasNextPage && filteredTraders.length > 0 && (
          <div className="py-3 text-center text-text-dim text-xs">
            -- end of leaderboard ({totalCount} traders) --
          </div>
        )}
      </div>
    </div>
  );
}
