// Real, runnable Dijkstra source (not simplified pseudocode) in two
// languages, line-synced to the same four phases the walkthrough steps
// through. Line numbers below are 1-indexed against SOURCE.split("\n") and
// were counted by hand against the exact strings — code-samples.test.ts
// checks every number stays in range so an edit to the source can't silently
// desync the highlight.

export type CodePhase = "start" | "popAndExpand" | "endPop" | "finish";
export type CodeLang = "python" | "java";

export const PYTHON_SOURCE = `import heapq

def dijkstra(graph, start, end):
    dist = {start: 0}
    parent = {start: None}
    heap = [(0, start)]
    visited = set()

    while heap:
        g, node = heapq.heappop(heap)
        if node in visited:
            continue
        visited.add(node)

        if node == end:
            break

        for neighbor, weight in graph[node]:
            tentative = g + weight
            if tentative < dist.get(neighbor, float("inf")):
                dist[neighbor] = tentative
                parent[neighbor] = node
                heapq.heappush(heap, (tentative, neighbor))

    return reconstruct(parent, end)


def reconstruct(parent, end):
    path = []
    node = end
    while node is not None:
        path.append(node)
        node = parent[node]
    path.reverse()
    return path
`;

export const JAVA_SOURCE = `import java.util.*;

class Dijkstra {
    record Edge(String to, int weight) {}
    record HeapEntry(int g, String node) {}

    static List<String> search(Map<String, List<Edge>> graph, String start, String end) {
        Map<String, Integer> dist = new HashMap<>();
        Map<String, String> parent = new HashMap<>();
        Set<String> visited = new HashSet<>();
        PriorityQueue<HeapEntry> heap = new PriorityQueue<>(Comparator.comparingInt(HeapEntry::g));

        dist.put(start, 0);
        heap.add(new HeapEntry(0, start));

        while (!heap.isEmpty()) {
            HeapEntry current = heap.poll();
            if (visited.contains(current.node())) continue;
            visited.add(current.node());

            if (current.node().equals(end)) break;

            for (Edge edge : graph.getOrDefault(current.node(), List.of())) {
                int tentative = current.g() + edge.weight();
                if (tentative < dist.getOrDefault(edge.to(), Integer.MAX_VALUE)) {
                    dist.put(edge.to(), tentative);
                    parent.put(edge.to(), current.node());
                    heap.add(new HeapEntry(tentative, edge.to()));
                }
            }
        }

        return reconstruct(parent, end);
    }

    static List<String> reconstruct(Map<String, String> parent, String end) {
        List<String> path = new ArrayList<>();
        String node = end;
        while (node != null) {
            path.add(node);
            node = parent.get(node);
        }
        Collections.reverse(path);
        return path;
    }
}
`;

export const CODE_SOURCE: Record<CodeLang, string> = {
  python: PYTHON_SOURCE,
  java: JAVA_SOURCE,
};

export const PHASE_LINES: Record<CodeLang, Record<CodePhase, number[]>> = {
  python: {
    start: [4, 5, 6, 7],
    popAndExpand: [10, 11, 12, 13, 18, 19, 20, 21, 22, 23],
    endPop: [10, 11, 12, 13, 15, 16],
    finish: [25, 28, 29, 30, 31, 32, 33, 34, 35],
  },
  java: {
    start: [8, 9, 10, 11, 13, 14],
    popAndExpand: [17, 18, 19, 23, 24, 25, 26, 27, 28],
    endPop: [17, 18, 19, 21],
    finish: [33, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45],
  },
};
