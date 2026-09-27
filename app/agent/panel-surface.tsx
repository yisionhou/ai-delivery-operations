/** Decorative surface only: content layout and reveal timing belong to the parent. */
export default function PanelSurface({ main = false }: { main?: boolean }) {
  return <div className={`pw-panel-surface${main ? ' pw-panel-surface-main' : ''}`} aria-hidden="true" />;
}
