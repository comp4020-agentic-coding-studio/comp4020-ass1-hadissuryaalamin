import { GraphController } from "./graph-controller.ts";
import { ScrollPinController } from "./scroll-pin-controller.ts";

const graph = new GraphController(document);
graph.start();

const trackEl = document.querySelector<HTMLElement>('[data-testid="scroll-track"]');
const pinEl = trackEl?.querySelector<HTMLElement>(".visualization") ?? null;
if (trackEl && pinEl) {
  new ScrollPinController(graph, trackEl, pinEl).start();
}
