/**
 * Dragging functionality for the overlay
 */

export function setupDragging(
  shadowRoot: ShadowRoot | null,
  container: HTMLElement | null,
  state: { isDragging: boolean; dragOffset: { x: number; y: number } },
): void {
  const dragHandle = shadowRoot?.getElementById("drag-handle");
  if (!dragHandle || !container) return;

  dragHandle.addEventListener("mousedown", (e: MouseEvent) => {
    state.isDragging = true;
    const rect = container.getBoundingClientRect();
    state.dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e: MouseEvent) => {
    if (!state.isDragging || !container) return;

    const x = e.clientX - state.dragOffset.x;
    const y = e.clientY - state.dragOffset.y;

    // Keep within viewport bounds
    const maxX = window.innerWidth - container.offsetWidth;
    const maxY = window.innerHeight - container.offsetHeight;

    container.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
    container.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
    container.style.right = "auto";
  });

  document.addEventListener("mouseup", () => {
    state.isDragging = false;
  });
}
