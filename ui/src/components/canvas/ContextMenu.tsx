import {
  useCallback,
  useState,
  useRef,
  useContext,
  useEffect,
  memo,
  ChangeEvent,
} from "react";
import * as React from "react";
import { useReactFlow, useStore as useRfStore, useKeyPress } from "reactflow";
import "reactflow/dist/style.css";

import FileUploadTwoToneIcon from "@mui/icons-material/FileUploadTwoTone";
import { debounce } from "lodash";
import { Button, DropdownMenu } from "@radix-ui/themes";
import { useAtom, useSetAtom } from "jotai";
import {
  ATOM_addNodeAtAnchor,
  ATOM_autoLayoutTree,
  ATOM_getInsertPosition,
  ATOM_isAddingNode,
  ATOM_mousePosition,
  ATOM_newNodeSpec,
  ATOM_nodes,
  ATOM_updateView,
  ATOM_updateView_addNode,
} from "@/lib/store/canvasSlice";

export function useAddNode(reactFlowWrapper) {
  const [isAddingNode, setIsAddingNode] = useAtom(ATOM_isAddingNode);
  const updateView = useSetAtom(ATOM_updateView);
  const updateView_addNode = useSetAtom(ATOM_updateView_addNode);
  const [mousePosition, setMousePosition] = useAtom(ATOM_mousePosition);
  const getInsertPosition = useSetAtom(ATOM_getInsertPosition);

  const reactFlowInstance = useReactFlow();
  const addNodeAtAnchor = useSetAtom(ATOM_addNodeAtAnchor);

  // cancel when ESC is pressed
  const escapePressed = useKeyPress("Escape");
  useEffect(() => {
    if (escapePressed) {
      console.log("escape pressed");
      setIsAddingNode(false);
      updateView();
    }
  }, [escapePressed]);

  // when add node mode activated
  // 1. there is a node moving with the mouse.
  // 2. We calculate the desired position to insert the node in the tree
  //    hierarchy, and show it on the canvas.
  // 3. when the user clicks, we insert the node in the tree hierarchy.

  const autoLayoutTree = useSetAtom(ATOM_autoLayoutTree);

  useEffect(() => {
    if (!reactFlowWrapper) return;
    if (!isAddingNode) return;
    const mouseMove = (event) => {
      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
      // show the node on the canvas
      setMousePosition(position);
      getInsertPosition();
      updateView_addNode();
    };
    const debouncedMouseMove = debounce(mouseMove, 1);
    const mouseClick = (event) => {
      // insert the node in the tree hierarchy
      addNodeAtAnchor();
      setIsAddingNode(false);
      autoLayoutTree();
      updateView();
    };

    reactFlowWrapper.current.addEventListener("mousemove", debouncedMouseMove);
    reactFlowWrapper.current.addEventListener("click", mouseClick);
    return () => {
      reactFlowWrapper.current.removeEventListener(
        "mousemove",
        debouncedMouseMove
      );
      reactFlowWrapper.current.removeEventListener("click", mouseClick);
    };
  }, [isAddingNode, reactFlowWrapper]);
}

export function useContextMenu() {
  const [showContextMenu, setShowContextMenu] = useState(false);

  const [points, setPoints] = useState({ x: 0, y: 0 });
  // const [client, setClient] = useState({ x: 0, y: 0 });

  const escapePressed = useKeyPress("Escape");
  useEffect(() => {
    if (escapePressed) {
      setShowContextMenu(false);
    }
  }, [escapePressed]);

  const onPaneContextMenu = (event) => {
    event.preventDefault();
    setShowContextMenu(true);
    setPoints({ x: event.pageX, y: event.pageY });
    // setClient({ x: event.clientX, y: event.clientY });
  };

  const onNodeContextMenu = (event, node) => {
    if (node?.type !== "SCOPE") return;

    event.preventDefault();
    setShowContextMenu(true);
    setPoints({ x: event.pageX, y: event.pageY });
    // setClient({ x: event.clientX, y: event.clientY });
  };

  return {
    points,
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

export function ContextMenu({ setShowContextMenu, handleItemClick }) {
  const setIsAddingNode = useSetAtom(ATOM_isAddingNode);
  const setNewNodeSpec = useSetAtom(ATOM_newNodeSpec);
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
          onClick={() => {
            setNewNodeSpec({ type: "RICH" });
            setIsAddingNode(true);
          }}
        >
          + Doc
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          shortcut="⌘ E"
          onClick={() => {
            setNewNodeSpec({ type: "CODE", lang: "python" });
            setIsAddingNode(true);
          }}
        >
          + Python
        </DropdownMenu.Item>
        <DropdownMenu.Item
          shortcut="⌘ E"
          onClick={() => {
            setNewNodeSpec({ type: "CODE", lang: "julia" });
            setIsAddingNode(true);
          }}
        >
          + Julia
        </DropdownMenu.Item>

        <DropdownMenu.Separator />
        <DropdownMenu.Item
          shortcut="⌘ N"
          onClick={() => {
            // handle CanvasContextMenu "import Jupyter notebook" click
            handleItemClick();
          }}
        >
          <FileUploadTwoToneIcon />
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
