interface Props {
  active: boolean;
  onClick: () => void;
}

export function StarButton({ active, onClick }: Props) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={active ? "Unfavorite" : "Favorite"}
      className={`inline-flex items-center justify-center shrink-0 transition-colors duration-150 ${
        active ? "text-amber" : "text-text-dim hover:text-amber"
      }`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}
