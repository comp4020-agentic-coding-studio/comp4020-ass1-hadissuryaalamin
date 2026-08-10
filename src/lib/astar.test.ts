import { describe, expect, it } from "vitest";
import { manhattan, search } from "./astar.ts";
import { createEmptyWalls, createTrapMaze, DEFAULT_END, DEFAULT_START, GRID_COLS, GRID_ROWS } from "./mazes.ts";

describe("search on an open grid (no walls)", () => {
  const walls = createEmptyWalls();
  const start = { row: 0, col: 0 };
  const end = { row: 4, col: 5 };

  it.each([0, 1, 2])("weight %i finds the Manhattan-optimal path with nothing in the way", (weight) => {
    const result = search(walls, start, end, weight);
    expect(result.pathLength).toBe(manhattan(start, end));
    expect(result.path[0]).toEqual(start);
    expect(result.path.at(-1)).toEqual(end);
  });

  it("reports the start cell as visited even when start === end", () => {
    const result = search(walls, start, start, 1);
    expect(result.pathLength).toBe(0);
    expect(result.path).toEqual([start]);
  });
});

describe("search when the end is unreachable", () => {
  it("returns pathLength -1 and an empty path", () => {
    const walls = createEmptyWalls();
    const end = { row: 5, col: 5 };
    for (let col = 0; col < GRID_COLS; col++) walls[end.row][col] = true;
    for (let row = 0; row < GRID_ROWS; row++) walls[row][end.col] = true;

    const result = search(walls, { row: 0, col: 0 }, end, 1);
    expect(result.pathLength).toBe(-1);
    expect(result.path).toEqual([]);
  });
});

describe("the trap maze — the property the whole site demonstrates", () => {
  const walls = createTrapMaze();

  it("Dijkstra (weight 0) finds the true shortest path", () => {
    const result = search(walls, DEFAULT_START, DEFAULT_END, 0);
    expect(result.pathLength).toBe(21);
  });

  it("A* (weight 1) also finds the true shortest path", () => {
    const result = search(walls, DEFAULT_START, DEFAULT_END, 1);
    expect(result.pathLength).toBe(21);
  });

  it("greedy best-first (weight 3) gets fooled into a strictly longer path", () => {
    const result = search(walls, DEFAULT_START, DEFAULT_END, 3);
    expect(result.pathLength).toBe(27);
    expect(result.pathLength).toBeGreaterThan(21);
  });

  it("expands fewer cells as weight increases — the speed side of the trade-off", () => {
    const dijkstra = search(walls, DEFAULT_START, DEFAULT_END, 0);
    const astar = search(walls, DEFAULT_START, DEFAULT_END, 1);
    const greedy = search(walls, DEFAULT_START, DEFAULT_END, 3);
    expect(dijkstra.expandedCount).toBeGreaterThan(astar.expandedCount);
    expect(astar.expandedCount).toBeGreaterThan(greedy.expandedCount);
  });

  it("every returned path is contiguous and walks only through open cells", () => {
    const result = search(walls, DEFAULT_START, DEFAULT_END, 3);
    for (let i = 0; i < result.path.length; i++) {
      const cell = result.path[i];
      expect(walls[cell.row][cell.col]).toBe(false);
      if (i > 0) {
        const prev = result.path[i - 1];
        expect(manhattan(prev, cell)).toBe(1);
      }
    }
  });
});
