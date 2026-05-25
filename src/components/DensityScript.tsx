// CAREERFLOW: redesign (PR E) — anti-FOUC density boot. Mirrors
// next-themes' inline-script trick: reads `localStorage.careerflow-density`
// before React hydrates and sets `data-density` on <html> so density-aware
// CSS rules apply on the first paint. The settings page is the source of
// truth (server-side, in `userSettings.display.density`) and writes back
// to localStorage on save; this script just keeps subsequent loads in
// sync without waiting on a network round-trip.

const SCRIPT = `(function () {
  try {
    var d = window.localStorage.getItem('careerflow-density');
    if (d !== 'compact' && d !== 'comfortable') d = 'comfortable';
    document.documentElement.setAttribute('data-density', d);
  } catch (e) {
    document.documentElement.setAttribute('data-density', 'comfortable');
  }
})();`;

export default function DensityScript() {
  return (
    <script
      // The inline script runs before any React work — set on <head> via
      // the root layout. Content is a string constant, so this is safe.
      dangerouslySetInnerHTML={{ __html: SCRIPT }}
    />
  );
}
