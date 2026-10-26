/**
 * Room below and above an element inside whatever clips it: the scrolling body of a dialog,
 * or the window. Used to decide whether a dropdown should open upward.
 */
export function roomAround(el: Element): { below: number; above: number } {
  const rect = el.getBoundingClientRect();
  const clip = el.closest('.modal-body')?.getBoundingClientRect();
  const bottom = clip ? clip.bottom : window.innerHeight;
  const top = clip ? clip.top : 0;
  return { below: bottom - rect.bottom, above: rect.top - top };
}

/** Open upward only when the list does not fit below but has more room above. */
export function shouldOpenUp(el: Element | null, needed: number): boolean {
  if (!el) return false;
  const { below, above } = roomAround(el);
  return below < needed && above > below;
}
