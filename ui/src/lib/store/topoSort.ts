/**
 * Topological sort the ids.
 * - If a cycle is detected, skip the edge causing the cycle and continue.
 * - Return the sorted ids.
 * - The adjacencySet might contain more ids. The result should only contain the
 *   ids that are in the input.
 * - If a -> b -> c in adjacencySet, and only a and c are in ids, then the
 *   result should only contain a and c, and a should appear before c.
 */
export function topoSort(
  ids: string[],
  adjacencySet: Map<string, Set<string>>
): string[] {
  // Create a set of input ids for O(1) lookup
  const idSet = new Set(ids);

  // Create a map to track visited nodes during DFS
  const visited = new Map<string, boolean>();
  // Track nodes in current DFS path to detect cycles
  const inPath = new Set<string>();
  // Store the result in reverse order (will reverse at end)
  const result: string[] = [];

  // Helper function to get direct and indirect dependencies that exist in input ids
  function getReachableDependencies(
    id: string,
    seen = new Set<string>()
  ): Set<string> {
    // If we've seen this node before in this traversal, return empty set to avoid cycles
    if (seen.has(id)) return new Set();

    seen.add(id);
    const reachable = new Set<string>();
    const deps = adjacencySet.get(id);
    if (!deps) return reachable;

    for (const dep of deps) {
      if (idSet.has(dep)) {
        reachable.add(dep);
      }
      // Add indirect dependencies that exist in input ids
      const indirectDeps = getReachableDependencies(dep, seen);
      for (const indirectDep of indirectDeps) {
        if (idSet.has(indirectDep)) {
          reachable.add(indirectDep);
        }
      }
    }
    return reachable;
  }

  // DFS function that handles cycles by skipping problematic edges
  function dfs(id: string): void {
    // Skip if already fully visited
    if (visited.get(id)) return;

    // Mark as being processed in current path
    inPath.add(id);

    // Get all reachable dependencies that exist in input ids
    const deps = getReachableDependencies(id);

    for (const dep of deps) {
      // Skip this edge if it would create a cycle
      if (inPath.has(dep)) continue;

      // Process dependency if not already done
      if (!visited.get(dep)) {
        dfs(dep);
      }
    }

    // Mark as visited and remove from current path
    visited.set(id, true);
    inPath.delete(id);

    // Only add to result if it's in the original input ids
    if (idSet.has(id)) {
      result.push(id);
    }
  }

  // Process all input ids
  for (const id of ids) {
    if (!visited.get(id)) {
      dfs(id);
    }
  }

  // Return reversed result (since we built it in reverse order)
  return result.reverse();
}

function runTests() {
  // Test 1: Simple topological sort without cycles
  const ids1 = ["a", "b", "c"];
  const adjSet1 = new Map<string, Set<string>>([
    ["a", new Set(["b"])],
    ["b", new Set(["c"])],
    ["c", new Set()],
  ]);
  console.log(topoSort(ids1, adjSet1)); // Expected: ['a', 'b', 'c']

  // Test 2: With disconnected nodes
  const ids2 = ["x", "y", "z"];
  const adjSet2 = new Map<string, Set<string>>([
    ["x", new Set(["y"])],
    ["y", new Set()],
    ["z", new Set()],
  ]);
  console.log(topoSort(ids2, adjSet2)); // Expected: ['x', 'y', 'z'] (order of z can vary)

  // Test 3: Skip cycle-causing edge
  const ids3 = ["a", "b", "c"];
  const adjSet3 = new Map<string, Set<string>>([
    ["a", new Set(["b"])],
    ["b", new Set(["c"])],
    ["c", new Set(["a"])], // This creates a cycle: a -> b -> c -> a
  ]);
  console.log(topoSort(ids3, adjSet3)); // Expected: ['a', 'b', 'c'] (skips the cycle edge)

  // Test 4: Nodes not in ids should be excluded from the result
  const ids4 = ["a", "c"];
  const adjSet4 = new Map<string, Set<string>>([
    ["a", new Set(["b"])],
    ["b", new Set(["c"])],
    ["c", new Set()],
  ]);
  console.log(topoSort(ids4, adjSet4)); // Expected: ['a', 'c']

  // Test 5: Multiple disconnected components
  const ids5 = ["a", "b", "x", "y"];
  const adjSet5 = new Map<string, Set<string>>([
    ["a", new Set(["b"])],
    ["b", new Set()],
    ["x", new Set(["y"])],
    ["y", new Set()],
  ]);
  console.log(topoSort(ids5, adjSet5)); // Expected: ['a', 'b', 'x', 'y'] or ['x', 'y', 'a', 'b']

  // Test 6: Empty ids and adjacency set
  const ids6: string[] = [];
  const adjSet6 = new Map<string, Set<string>>();
  console.log(topoSort(ids6, adjSet6)); // Expected: []
}

// Run the tests
// runTests();
