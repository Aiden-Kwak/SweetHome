import "./pitch-launcher.css";

export default function PitchLauncher() {
  return (
    <a className="pitch-launcher" href="/pitch/index.html" target="_blank" rel="noopener noreferrer"
      aria-label="Presentation / 발표자료 (opens in a new tab)">
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 4h18M5 4v12h14V4M12 16v5m-4 0 4-3 4 3M9 8l6 3-6 3V8Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Presentation <small>발표자료</small></span>
    </a>
  );
}
