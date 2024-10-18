/**
 * Topological sort the ids.
 * - If a cycle is detected, skip the edge causing the cycle and continue.
 * - Return the sorted ids.
 * - The adjacencySet might contain more ids. The result should only contain the
 *   ids that are in the input.
 * - If a -> b -> c in adjacencySet, and only a and c are in ids, then the
 *   result should only contain a and c, and a should appear before c.
 * - [DEPRECATED] It should be stable, i.e., if topoSort doesn't affect the order of a and b,
 *   they should preserve the relative order as in the input.
 */
export function topoSort(
  ids: string[],
  adjacencySet: Map<string, Set<string>>
): string[] {
  const sorted: string[] = [];
  const visited: Set<string> = new Set();
  const visiting: Set<string> = new Set(); // To detect cycles

  // Helper function to perform DFS
  function dfs(nodeId: string): boolean {
    if (visited.has(nodeId)) return true; // Already processed
    if (visiting.has(nodeId)) return false; // Cycle detected

    visiting.add(nodeId);

    const neighbors = adjacencySet.get(nodeId) || new Set();
    for (const neighbor of neighbors) {
      if (visiting.has(neighbor)) {
        // Cycle detected, skip this edge
        console.warn(
          `Cycle detected between ${nodeId} and ${neighbor}. Skipping edge.`
        );
        continue;
      }
      if (!dfs(neighbor)) {
        // If the neighbor caused a cycle, continue without modifying the adjacency set
        continue;
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    sorted.push(nodeId);

    return true;
  }

  // Perform DFS on all nodes
  for (const id of ids) {
    if (!visited.has(id)) {
      dfs(id);
    }
  }

  const result = sorted.reverse(); // Reverse because we want to return in topological order
  // return only the ids that were in the input
  const idSet = new Set(ids);
  return result.filter((id) => idSet.has(id));
}
