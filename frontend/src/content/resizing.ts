/**
 * Resizing functionality for the overlay
 */

export function setupResizing(
  shadowRoot: ShadowRoot | null,
  container: HTMLElement | null,
  state: {
    isResizing: boolean;
    resizeStart: { width: number; height: number; x: number; y: number };
  },
): void {
  const resizeHandle = shadowRoot?.getElementById("resize-handle");
  if (!resizeHandle || !container) return;

  resizeHandle.addEventListener("mousedown", (e: MouseEvent) => {
    state.isResizing = true;
    container.classList.add("resizing");
    state.resizeStart = {
      width: container.offsetWidth,
      height: container.offsetHeight,
      x: e.clientX,
      y: e.clientY,
    };
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener("mousemove", (e: MouseEvent) => {
    if (!state.isResizing || !container) return;

    const deltaX = e.clientX - state.resizeStart.x;
    const deltaY = e.clientY - state.resizeStart.y;

    const newWidth = Math.max(
      280,
      Math.min(state.resizeStart.width + deltaX, window.innerWidth * 0.9),
    );
    const newHeight = Math.max(
      150,
      Math.min(state.resizeStart.height + deltaY, window.innerHeight * 0.9),
    );

    container.style.width = `${newWidth}px`;
    container.style.height = `${newHeight}px`;
  });

  document.addEventListener("mouseup", () => {
    if (state.isResizing) {
      state.isResizing = false;
      container?.classList.remove("resizing");
    }
  });
}
