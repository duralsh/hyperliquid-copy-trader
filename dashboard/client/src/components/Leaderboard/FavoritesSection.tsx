import { formatUSD, formatPnl, formatRoi, formatVolume, shortenAddress } from "../../utils/format.js";
import { StarButton } from "../StarButton.js";
import { CopyButton } from "../CopyButton.js";
import type { TraderSummary, TimeWindow } from "../../../../shared/types.js";

interface Props {
  traders: TraderSummary[];
  window: TimeWindow;
  toggleFavorite: (address: string, trader?: TraderSummary) => void;
  onSelectTrader: (trader: TraderSummary) => void;
  selectedAddress?: string;
}

export function FavoritesSection({ traders, window, toggleFavorite, onSelectTrader, selectedAddress }: Props) {
  if (traders.length === 0) return null;

  return (
    <div
      className="mb-4 border border-amber/20 rounded-lg bg-amber/[0.02] overflow-hidden"
      style={{
        borderTop: "3px solid transparent",
        borderImage: "linear-gradient(90deg, #ffb000, #ffb00060, transparent) 1",
        borderImageSlice: "3 1 1 1",
        boxShadow: "0 0 15px rgba(255,176,0,0.04), inset 0 1px 0 rgba(255,176,0,0.06)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-amber/15 bg-amber/[0.03]">
        <div
          className="flex items-center justify-center"
          style={{ filter: "drop-shadow(0 0 4px rgba(255,176,0,0.4))" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" className="text-amber">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>
        <span
          className="text-amber text-xs font-bold tracking-wider"
          style={{ textShadow: "0 0 8px rgba(255,176,0,0.3)" }}
        >
          FAVORITES
        </span>
        <span className="text-amber/70 text-[10px] bg-amber/10 border border-amber/20 px-2 py-0.5 rounded-full tabular-nums font-bold">
          {traders.length}
        </span>
      </div>

      {/* Table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-text-dim border-b border-amber/15" style={{ background: "linear-gradient(180deg, rgba(255,176,0,0.04) 0%, transparent 100%)" }}>
            <th className="py-2.5 px-2 w-8"></th>
            <th className="py-2.5 px-2 text-left text-xs font-bold tracking-wider">TRADER</th>
            <th className="py-2.5 px-2 text-right text-xs font-bold tracking-wider">ACCOUNT</th>
            <th className="py-2.5 px-2 text-right text-xs font-bold tracking-wider">PNL</th>
            <th className="py-2.5 px-2 text-right text-xs font-bold tracking-wider">ROI</th>
            <th className="py-2.5 pr-6 pl-2 text-right text-xs font-bold tracking-wider">VOLUME</th>
          </tr>
        </thead>
        <tbody>
          {traders.map((t, idx) => (
            <tr
              key={t.address}
              onClick={() => onSelectTrader(t)}
              className={`cursor-pointer transition-all duration-150 ${
                selectedAddress === t.address
                  ? "bg-green/[0.12] border-l-[3px] border-l-green shadow-[inset_0_0_20px_rgba(0,255,65,0.06)]"
                  : idx % 2 === 0 ? "row-even" : "row-odd"
              } hover:bg-amber/[0.04] hover:shadow-[inset_3px_0_0_rgba(255,176,0,0.4)]`}
            >
              <td className="py-2.5 px-2 w-8">
                <StarButton active onClick={() => toggleFavorite(t.address)} />
              </td>
              <td className="py-2.5 px-2">
                <div className="flex items-center gap-1">
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
    </div>
  );
}
