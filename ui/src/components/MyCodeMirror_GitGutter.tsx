import { EditorView, basicSetup } from "codemirror";
import {
  EditorState,
  StateEffect,
  Extension,
  StateField,
  RangeSet,
  Range,
  Transaction,
} from "@codemirror/state";
import { GutterMarker, gutter, ViewUpdate } from "@codemirror/view";

// Git change types
type GitChangeType = "add" | "delete" | "modify";

interface GitChange {
  from: number;
  to: number;
  type: GitChangeType;
}

// Custom gutter marker for git changes
class GitGutterMarker extends GutterMarker {
  constructor(private type: GitChangeType) {
    super();
  }

  toDOM() {
    const marker = document.createElement("div");
    marker.className = `git-gutter-marker git-${this.type}`;
    return marker;
  }
}

// Function to compute line-based differences
function computeGitChanges(oldCode: string, newCode: string): GitChange[] {
  // Temporary fix for the bug that the first line of added content is marked as
  // modified. This only work where old content is empty.
  if (!oldCode.trim()) {
    const newLines = newCode.split("\n");
    return newLines.map((_, index) => ({
      from: index + 1,
      to: index + 1,
      type: "add" as GitChangeType,
    }));
  }

  const changes: GitChange[] = [];

  const oldLines = oldCode.split("\n");
  const newLines = newCode.split("\n");

  // LCS-based diff algorithm
  const lcs = longestCommonSubsequence(oldLines, newLines);

  let oldIndex = 0;
  let newIndex = 0;
  let lcsIndex = 0;

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (
      lcsIndex < lcs.length &&
      oldIndex < oldLines.length &&
      newIndex < newLines.length &&
      oldLines[oldIndex] === lcs[lcsIndex] &&
      newLines[newIndex] === lcs[lcsIndex]
    ) {
      // Lines match in both versions
      oldIndex++;
      newIndex++;
      lcsIndex++;
    } else if (
      oldIndex < oldLines.length &&
      (lcsIndex >= lcs.length || oldLines[oldIndex] !== lcs[lcsIndex])
    ) {
      // Line was deleted
      changes.push({
        from: newIndex + 1,
        to: newIndex + 1,
        type: "delete",
      });
      oldIndex++;
    } else if (
      newIndex < newLines.length &&
      (lcsIndex >= lcs.length || newLines[newIndex] !== lcs[lcsIndex])
    ) {
      // Line was added
      changes.push({
        from: newIndex + 1,
        to: newIndex + 1,
        type: "add",
      });
      newIndex++;
    }
  }

  // Post-process changes to detect modifications
  const processedChanges: GitChange[] = [];
  let i = 0;

  while (i < changes.length) {
    const current = changes[i];
    const next = changes[i + 1];

    if (
      current.type === "delete" &&
      next &&
      next.type === "add" &&
      Math.abs(current.from - next.from) <= 1
    ) {
      // Convert adjacent delete-add pairs to modifications
      processedChanges.push({
        from: current.from,
        to: current.to,
        type: "modify",
      });
      i += 2;
    } else {
      processedChanges.push(current);
      i++;
    }
  }

  return processedChanges;
}

// Helper function to compute Longest Common Subsequence
function longestCommonSubsequence(arr1: string[], arr2: string[]): string[] {
  const m = arr1.length;
  const n = arr2.length;
  const dp: number[][] = Array(m + 1)
    .fill(0)
    .map(() => Array(n + 1).fill(0));

  // Build LCS lengths
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1] === arr2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Reconstruct LCS
  const lcs: string[] = [];
  let i = m,
    j = n;

  while (i > 0 && j > 0) {
    if (arr1[i - 1] === arr2[j - 1]) {
      lcs.unshift(arr1[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

export function gitGutterExtension(startingCode: string) {
  const gitField = StateField.define<string>({
    create: () => startingCode,
    update: (value, tr) => value,
  });

  const gutterMarkerField = StateField.define<RangeSet<GutterMarker>>({
    create: (state) => {
      // const changes = computeGitChanges(startingCode, startingCode);
      // const markers = changes.map((change) => ({
      //   from: 0,
      //   to: 0,
      //   value: new GitGutterMarker(change.type),
      // }));
      // return RangeSet.of(markers);
      const newCode = state.doc.toString();
      const changes = computeGitChanges(startingCode, newCode);

      const newMarkers = changes.map((change) => ({
        from: state.doc.line(Math.min(change.from, state.doc.lines)).from,
        to: state.doc.line(Math.min(change.from, state.doc.lines)).from,
        value: new GitGutterMarker(change.type),
      })) as Range<GutterMarker>[];

      return RangeSet.of(newMarkers);
    },
    update: (markers, tr) => {
      if (!tr.docChanged) return markers;

      const oldCode = tr.startState.field(gitField);
      const newCode = tr.state.doc.toString();
      const changes = computeGitChanges(oldCode, newCode);

      const newMarkers = changes.map((change) => ({
        from: tr.state.doc.line(Math.min(change.from, tr.state.doc.lines)).from,
        to: tr.state.doc.line(Math.min(change.from, tr.state.doc.lines)).from,
        value: new GitGutterMarker(change.type),
      })) as Range<GutterMarker>[];

      return RangeSet.of(newMarkers);
    },
  });

  return [
    gitField,
    gutterMarkerField,
    gutter({
      class: "git-gutter",
      markers: (view) => view.state.field(gutterMarkerField),
      initialSpacer: () => new GitGutterMarker("modify"),
    }),
    // FIXME: Adding this here will make it VERY slow to create the editors.
    //
    // EditorView.baseTheme({
    //   ".git-gutter": {
    //     width: "4px",
    //     backgroundColor: "transparent",
    //     marginRight: "3px",
    //   },
    //   ".git-gutter-marker": {
    //     width: "4px",
    //     height: "100%",
    //     borderRadius: "2px",
    //   },
    //   ".git-add": {
    //     backgroundColor: "#28a745",
    //   },
    //   ".git-delete": {
    //     backgroundColor: "#dc3545",
    //   },
    //   ".git-modify": {
    //     backgroundColor: "#ffc107",
    //   },
    // }),
  ];
}
