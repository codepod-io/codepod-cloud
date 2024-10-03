import { useState, useEffect, ChangeEvent, useRef } from "react";
import {
  Node,
  Edge,
  EdgeMouseHandler,
  useKeyPress,
  useReactFlow,
  XYPosition,
} from "@xyflow/react";

import { Box, Button, DropdownMenu } from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { ATOM_nodes } from "@/lib/store/canvasSlice";
import { FileUp, NotebookPen, Clipboard } from "lucide-react";
import {
  JavaScriptLogo,
  JuliaLogo,
  PythonLogo,
  RacketLogo,
} from "../nodes/utils";
import {
  ATOM_addNode,
  ATOM_addScope,
  ATOM_deleteEdge,
} from "@/lib/store/cavnasSlice_addNode";
import { myassert } from "@/lib/utils/utils";
import { ATOM_nodesMap } from "@/lib/store/yjsSlice";
import { AppNode } from "@/lib/store/types";

export function useUpload() {
  const nodes = useAtom(ATOM_nodes);

  const handleFileInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const fileName = e.target.files[0].name;
    console.log("Import Jupyter Notebook or Python scripts: ", fileName);
    const fileReader = new FileReader();
    fileReader.onload = (e) => {
      const fileContent =
        typeof e.target!.result === "string"
          ? e.target!.result
          : Buffer.from(e.target!.result!).toString();
      let cellList: any[] = [];
      let importScopeName = "";
      switch (fileName.split(".").pop()) {
        case "ipynb":
          cellList = JSON.parse(String(fileContent)).cells.map((cell) => ({
            cellType: cell.cell_type,
            cellSource: cell.source.join(""),
            cellOutputs: cell.outputs || [],
            execution_count: cell.execution_count || 0,
          }));
          importScopeName = fileName.substring(0, fileName.length - 6);
          break;
        case "py":
          cellList = [{ cellType: "code", cellSource: String(fileContent) }];
          break;
        default:
          return;
      }

      // TODO enable this on new Tree layout.
      // importLocalCode(
      //   project({ x: client.x, y: client.y }),
      //   importScopeName,
      //   cellList
      // );
    };
    fileReader.readAsText(e.target.files[0], "UTF-8");
  };

  return { handleFileInputChange };
}

export function usePaneContextMenu() {
  const [showContextMenu, setShowContextMenu] = useState(false);

  const [pagePosition, setPagePosition] = useState({ x: 0, y: 0 });
  const [clientPosition, setClientPositin] = useState({ x: 0, y: 0 });

  const escapePressed = useKeyPress("Escape");
  useEffect(() => {
    if (escapePressed) {
      setShowContextMenu(false);
    }
  }, [escapePressed]);

  const onContextMenu = (event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    setShowContextMenu(true);
    setPagePosition({ x: event.pageX, y: event.pageY });
    setClientPositin({ x: event.clientX, y: event.clientY });
  };

  const addNode = useSetAtom(ATOM_addNode);
  // TODO calculate position of context menu right click
  const { screenToFlowPosition } = useReactFlow();
  const position = screenToFlowPosition(clientPosition);

  // ----------------
  // get scope at the position
  // ----------------

  const { getIntersectingNodes } = useReactFlow<AppNode>();

  // get scope at the position
  const scopes = getIntersectingNodes({
    x: position.x,
    y: position.y,
    width: 1,
    height: 1,
  }).filter((node) => node.type === "SCOPE");

  // the the innermost scope
  const scopeId =
    scopes.length === 0
      ? undefined
      : scopes.sort((a, b) => (b.data.level ?? 0) - (a.data.level ?? 0))[0].id;

  // ----------------
  // handle file upload
  // ----------------
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { handleFileInputChange } = useUpload();

  const handleItemClick = () => {
    fileInputRef!.current!.click();
    fileInputRef!.current!.value = "";
  };

  const contextMenu = (
    <Box
      style={{
        left: `${pagePosition.x}px`,
        top: `${pagePosition.y}px`,
        zIndex: 100,
        // FIXME still a little offset
        position: "fixed",
        boxShadow: "0px 1px 8px 0px rgba(0, 0, 0, 0.1)",
        // width: '200px',
        backgroundColor: "#fff",
        borderRadius: "5px",
        boxSizing: "border-box",
      }}
    >
      <input
        type="file"
        accept=".ipynb, .py"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={(e) => handleFileInputChange(e)}
      />
      {showContextMenu && (
        <DropdownMenu.Root
          open={true}
          onOpenChange={(open) => {
            setShowContextMenu(false);
          }}
        >
          <DropdownMenu.Trigger>
            <Button
              variant="ghost"
              style={{
                width: 0,
                height: 0,
                opacity: 0,
              }}
            >
              Options
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item
              shortcut="⌘ D"
              onSelect={() => {
                addNode({ position, scopeId, type: "RICH" });
              }}
            >
              <NotebookPen /> Note
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              shortcut="⌘ E"
              onSelect={() => {
                addNode({ position, scopeId, type: "CODE", lang: "python" });
              }}
            >
              <PythonLogo />
              Python
            </DropdownMenu.Item>
            <DropdownMenu.Item
              shortcut="⌘ E"
              onSelect={() => {
                addNode({ position, scopeId, type: "CODE", lang: "julia" });
              }}
            >
              <JuliaLogo />
              Julia
            </DropdownMenu.Item>

            <DropdownMenu.Item
              shortcut="⌘ E"
              onSelect={() => {
                addNode({
                  position,
                  scopeId,
                  type: "CODE",
                  lang: "javascript",
                });
              }}
            >
              <JavaScriptLogo />
              JavaScript
            </DropdownMenu.Item>

            <DropdownMenu.Item
              shortcut="⌘ E"
              onSelect={() => {
                addNode({ position, scopeId, type: "CODE", lang: "racket" });
              }}
            >
              <RacketLogo />
              Racket
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              shortcut="⌘ N"
              onClick={() => {
                // handle CanvasContextMenu "import Jupyter notebook" click
                handleItemClick();
              }}
            >
              <FileUp />
              Import
            </DropdownMenu.Item>

            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger>More</DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent>
                <DropdownMenu.Item>Move to project…</DropdownMenu.Item>
                <DropdownMenu.Item>Move to folder…</DropdownMenu.Item>

                <DropdownMenu.Separator />
                <DropdownMenu.Item>Advanced options…</DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      )}
    </Box>
  );

  return {
    onContextMenu,
    contextMenu,
  };
}

export function useEdgeContextMenu() {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [edgeId, setEdgeId] = useState<string | null>(null);

  const [pagePosition, setPagePosition] = useState({ x: 0, y: 0 });
  const [clientPosition, setClientPositin] = useState({ x: 0, y: 0 });

  const escapePressed = useKeyPress("Escape");
  useEffect(() => {
    if (escapePressed) {
      setShowContextMenu(false);
    }
  }, [escapePressed]);

  const onEdgeContextMenu = (event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    setShowContextMenu(true);
    setEdgeId(edge.id);
    setPagePosition({ x: event.pageX, y: event.pageY });
    setClientPositin({ x: event.clientX, y: event.clientY });
  };

  const deleteEdge = useSetAtom(ATOM_deleteEdge);

  const edgeContextMenu = showContextMenu && (
    <Box
      style={{
        left: `${pagePosition.x}px`,
        top: `${pagePosition.y}px`,
        zIndex: 100,
        // FIXME still a little offset
        position: "fixed",
        boxShadow: "0px 1px 8px 0px rgba(0, 0, 0, 0.1)",
        // width: '200px',
        backgroundColor: "#fff",
        borderRadius: "5px",
        boxSizing: "border-box",
      }}
    >
      <DropdownMenu.Root
        open={true}
        onOpenChange={(open) => {
          setShowContextMenu(false);
        }}
      >
        <DropdownMenu.Trigger>
          <Button
            variant="ghost"
            style={{
              width: 0,
              height: 0,
              opacity: 0,
            }}
          >
            Options
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item
            shortcut="⌘ D"
            disabled={!edgeId}
            onSelect={() => {
              myassert(edgeId);
              deleteEdge(edgeId);
            }}
          >
            Delete Edge
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </Box>
  );

  return {
    onEdgeContextMenu,
    edgeContextMenu,
  };
}

export function useSelectionContextMenu() {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);

  const [pagePosition, setPagePosition] = useState({ x: 0, y: 0 });
  const [clientPosition, setClientPositin] = useState({ x: 0, y: 0 });

  const escapePressed = useKeyPress("Escape");
  useEffect(() => {
    if (escapePressed) {
      setShowContextMenu(false);
    }
  }, [escapePressed]);

  const onSelectionContextMenu = (event: React.MouseEvent, nodes: Node[]) => {
    event.preventDefault();
    setShowContextMenu(true);
    setSelectedNodes(nodes);

    setPagePosition({ x: event.pageX, y: event.pageY });
    setClientPositin({ x: event.clientX, y: event.clientY });
  };
  const addScope = useSetAtom(ATOM_addScope);

  const selectionContextMenu = showContextMenu && (
    <Box
      style={{
        left: `${pagePosition.x}px`,
        top: `${pagePosition.y}px`,
        zIndex: 100,
        // FIXME still a little offset
        position: "fixed",
        boxShadow: "0px 1px 8px 0px rgba(0, 0, 0, 0.1)",
        // width: '200px',
        backgroundColor: "#fff",
        borderRadius: "5px",
        boxSizing: "border-box",
      }}
    >
      <DropdownMenu.Root
        open={true}
        onOpenChange={(open) => {
          setShowContextMenu(false);
        }}
      >
        <DropdownMenu.Trigger>
          <Button
            variant="ghost"
            style={{
              width: 0,
              height: 0,
              opacity: 0,
            }}
          >
            Options
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item
            shortcut="⌘ D"
            onSelect={() => {
              myassert(selectedNodes.length > 0);
              addScope(selectedNodes);
            }}
          >
            Create Scope
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </Box>
  );

  return {
    onSelectionContextMenu,
    selectionContextMenu,
  };
}
