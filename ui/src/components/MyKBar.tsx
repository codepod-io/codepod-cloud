import { ATOM_autoLayoutTree } from "@/lib/store/canvasSlice";
import { useSetAtom } from "jotai";
import {
  KBarProvider,
  KBarPortal,
  KBarPositioner,
  KBarAnimator,
  KBarSearch,
  KBarResults,
  useMatches,
  NO_GROUP,
} from "kbar";

function RenderResults() {
  const { results } = useMatches();

  return (
    <KBarResults
      items={results}
      onRender={({ item, active }) =>
        typeof item === "string" ? (
          <div>{item}</div>
        ) : (
          <div
            style={{
              background: active ? "#eee" : "white",
              padding: "12px 16px",
              borderLeft: `2px solid ${active ? "red" : "transparent"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
            }}
          >
            {item.name}
          </div>
        )
      }
    />
  );
}

export function MyKBar() {
  const autoLayoutTree = useSetAtom(ATOM_autoLayoutTree);
  const actions = [
    {
      id: "auto-layout",
      name: "Auto Layout",
      keywords: "auto layout",
      perform: () => {
        autoLayoutTree();
      },
    },
    {
      id: "blog",
      name: "Blog",
      shortcut: ["b"],
      keywords: "writing words",
      perform: () => {
        console.log("TODO");
      },
    },
    {
      id: "contact",
      name: "Contact",
      shortcut: ["c"],
      keywords: "email",
      perform: () => (window.location.pathname = "contact"),
    },
  ];
  return (
    <KBarProvider actions={actions}>
      <KBarPortal>
        <KBarPositioner>
          <KBarAnimator
            style={{
              maxWidth: "600px",
              width: "100%",
              borderRadius: "8px",
              overflow: "hidden",
              boxShadow: "var(--shadow)",
            }}
          >
            <KBarSearch
              style={{
                padding: "12px 16px",
                fontSize: "16px",
                width: "100%",
                outline: "none",
                border: "none",
              }}
            />
            <RenderResults />
          </KBarAnimator>
        </KBarPositioner>
      </KBarPortal>
    </KBarProvider>
  );
}
