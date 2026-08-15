import { GraphController } from "./graph-controller.ts";
import { ScrollPinController } from "./scroll-pin-controller.ts";

const graph = new GraphController(document);
graph.start();

const trackEl = document.querySelector<HTMLElement>('[data-testid="scroll-track"]');
const pinEl = trackEl?.querySelector<HTMLElement>(".visualization") ?? null;
if (trackEl && pinEl) {
  const pin = new ScrollPinController(graph, trackEl, pinEl);
  pin.start();
  // Vite HMR reruns this module on save without a full page reload, which
  // would otherwise stack a second ScrollTrigger/matchMedia instance on top
  // of the first — kill this one before the replacement module runs.
  import.meta.hot?.dispose(() => pin.destroy());
}
