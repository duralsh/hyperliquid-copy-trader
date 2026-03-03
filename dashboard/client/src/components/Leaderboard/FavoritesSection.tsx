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
    <div className="mb-4 border border-amber/30 rounded bg-amber/[0.03]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-amber/20">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" className="text-amber">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <span className="text-amber text-xs font-bold tracking-wider">FAVORITES</span>
        <span className="text-amber/60 text-[10px] bg-amber/10 px-1.5 py-0.5 rounded tabular-nums">{traders.length}</span>
      </div>

      {/* Table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-text-dim border-b border-amber/20">
            <th className="py-2 px-2 w-8"></th>
            <th className="py-2 px-2 text-left text-xs font-bold tracking-wider">TRADER</th>
            <th className="py-2 px-2 text-right text-xs font-bold tracking-wider">ACCOUNT</th>
            <th className="py-2 px-2 text-right text-xs font-bold tracking-wider">PNL</th>
            <th className="py-2 px-2 text-right text-xs font-bold tracking-wider">ROI</th>
            <th className="py-2 pr-6 pl-2 text-right text-xs font-bold tracking-wider">VOLUME</th>
          </tr>
        </thead>
        <tbody>
          {traders.map((t, idx) => (
            <tr
              key={t.address}
              onClick={() => onSelectTrader(t)}
              className={`row-hover-accent cursor-pointer transition-colors ${
                selectedAddress === t.address
                  ? "bg-green/20 border-l-[3px] border-l-green"
                  : idx % 2 === 0 ? "row-even" : "row-odd"
              }`}
            >
              <td className="py-2 px-2 w-8">
                <StarButton active onClick={() => toggleFavorite(t.address)} />
              </td>
              <td className="py-2 px-2">
                <div className="flex items-center gap-1">
                  <span className="text-amber text-sm">{t.displayName || shortenAddress(t.address)}</span>
                  {t.displayName && (
                    <span className="text-text-dim text-xs ml-1">{shortenAddress(t.address)}</span>
                  )}
                  <CopyButton text={t.address} />
                </div>
              </td>
              <td className="py-2 px-2 text-right tabular-nums text-sm">{formatUSD(t.accountValue)}</td>
              <td className={`py-2 px-2 text-right tabular-nums text-sm ${t.pnl[window] >= 0 ? "text-green" : "text-red"}`}>
                {formatPnl(t.pnl[window])}
              </td>
              <td className={`py-2 px-2 text-right tabular-nums text-sm ${t.roi[window] >= 0 ? "text-green" : "text-red"}`}>
                {formatRoi(t.roi[window])}
              </td>
              <td className="py-2 pr-6 pl-2 text-right tabular-nums text-sm text-text-dim">
                {formatVolume(t.volume[window])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
