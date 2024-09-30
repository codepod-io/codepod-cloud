import { useState, useEffect, ChangeEvent } from "react";
import { useKeyPress, useReactFlow, XYPosition } from "@xyflow/react";

import { Button, DropdownMenu } from "@radix-ui/themes";
import { useAtom, useSetAtom } from "jotai";
import { ATOM_nodes } from "@/lib/store/canvasSlice";
import { FileUp, NotebookPen, Clipboard } from "lucide-react";
import {
  JavaScriptLogo,
  JuliaLogo,
  PythonLogo,
  RacketLogo,
} from "../nodes/utils";
import { ATOM_addNode } from "@/lib/store/cavnasSlice_addNode";

export function useContextMenu() {
  const [showContextMenu, setShowContextMenu] = useState(false);

  const [pagePosition, setPagePosition] = useState({ x: 0, y: 0 });
  const [clientPosition, setClientPositin] = useState({ x: 0, y: 0 });

  const escapePressed = useKeyPress("Escape");
  useEffect(() => {
    if (escapePressed) {
      setShowContextMenu(false);
    }
  }, [escapePressed]);

  const onPaneContextMenu = (event) => {
    event.preventDefault();
    setShowContextMenu(true);
    setPagePosition({ x: event.pageX, y: event.pageY });
    setClientPositin({ x: event.clientX, y: event.clientY });
  };

  const onNodeContextMenu = (event, node) => {
    if (node?.type !== "SCOPE") return;

    event.preventDefault();
    setShowContextMenu(true);
    setPagePosition({ x: event.pageX, y: event.pageY });
    setClientPositin({ x: event.clientX, y: event.clientY });
  };

  return {
    pagePosition,
    clientPosition,
    showContextMenu,
    setShowContextMenu,
    onPaneContextMenu,
    onNodeContextMenu,
  };
}

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

export function ContextMenu({
  setShowContextMenu,
  handleItemClick,
  clientPosition,
}: {
  setShowContextMenu: any;
  handleItemClick: any;
  clientPosition: XYPosition;
}) {
  const addNode = useSetAtom(ATOM_addNode);
  // TODO calculate position of context menu right click
  const { screenToFlowPosition } = useReactFlow();
  const position = screenToFlowPosition(clientPosition);
  return (
    <DropdownMenu.Root
      open={true}
      onOpenChange={(open) => {
        console.log("onOpenChange");
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
            addNode({ position, type: "RICH" });
          }}
        >
          <NotebookPen /> Note
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          shortcut="⌘ E"
          onSelect={() => {
            addNode({ position, type: "CODE", lang: "python" });
          }}
        >
          <PythonLogo />
          Python
        </DropdownMenu.Item>
        <DropdownMenu.Item
          shortcut="⌘ E"
          onSelect={() => {
            addNode({ position, type: "CODE", lang: "julia" });
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
            addNode({ position, type: "CODE", lang: "racket" });
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
  );
}
