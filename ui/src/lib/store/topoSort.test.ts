import { describe, expect, test } from "vitest";
import { topoSort } from "./topoSort";

describe("topoSort", () => {
  // Helper function to create a Map from array of [key, values[]] pairs
  function createAdjSet(edges: [string, string[]][]): Map<string, Set<string>> {
    return new Map(edges.map(([key, values]) => [key, new Set(values)]));
  }

  test("empty input", () => {
    expect(topoSort([], new Map())).toEqual([]);
  });

  test("single node", () => {
    const ids = ["a"];
    const adjSet = createAdjSet([["a", []]]);
    expect(topoSort(ids, adjSet)).toEqual(["a"]);
  });

  test("simple chain", () => {
    const ids = ["a", "b", "c"];
    const adjSet = createAdjSet([
      ["a", ["b"]],
      ["b", ["c"]],
      ["c", []],
    ]);
    const result = topoSort(ids, adjSet);
    expect(result).toEqual(["a", "b", "c"]);
  });

  test("skip missing intermediate node", () => {
    const ids = ["a", "c"]; // 'b' is missing
    const adjSet = createAdjSet([
      ["a", ["b"]],
      ["b", ["c"]],
      ["c", []],
    ]);
    const result = topoSort(ids, adjSet);
    expect(result).toContain("a");
    expect(result).toContain("c");
    expect(result.length).toBe(2);
    expect(result.indexOf("a")).toBeLessThan(result.indexOf("c"));
  });

  test("skip cycle-causing edge", () => {
    const ids = ["a", "b", "c"];
    const adjSet = createAdjSet([
      ["a", ["b"]],
      ["b", ["c"]],
      ["c", ["a"]], // creates cycle
    ]);
    const result = topoSort(ids, adjSet);
    expect(result.length).toBe(3);
    expect(new Set(result)).toEqual(new Set(["a", "b", "c"]));
  });

  test("complex graph with multiple paths", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const adjSet = createAdjSet([
      ["a", ["b", "c"]],
      ["b", ["d"]],
      ["c", ["d", "e"]],
      ["d", ["e"]],
      ["e", []],
    ]);
    const result = topoSort(ids, adjSet);
    expect(result.length).toBe(5);
    expect(new Set(result)).toEqual(new Set(ids));
  });

  test("disconnected components", () => {
    const ids = ["a", "b", "x", "y"];
    const adjSet = createAdjSet([
      ["a", ["b"]],
      ["b", []],
      ["x", ["y"]],
      ["y", []],
    ]);
    const result = topoSort(ids, adjSet);
    expect(result.length).toBe(4);
    expect(new Set(result)).toEqual(new Set(ids));
  });

  test("complex cycles", () => {
    const ids = ["a", "b", "c", "d"];
    const adjSet = createAdjSet([
      ["a", ["b"]],
      ["b", ["c"]],
      ["c", ["d"]],
      ["d", ["b"]], // creates cycle b -> c -> d -> b
    ]);
    const result = topoSort(ids, adjSet);
    expect(result.length).toBe(4);
    expect(new Set(result)).toEqual(new Set(ids));
  });
});
