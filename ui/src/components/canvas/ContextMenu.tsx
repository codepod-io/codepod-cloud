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

import { useStore } from "zustand";

import { RepoContext } from "@/lib/store";

import { getAbsPos, newNodeShapeConfig } from "@/lib/store/canvasSlice";
import FileUploadTwoToneIcon from "@mui/icons-material/FileUploadTwoTone";
import { debounce } from "lodash";
import { Button, DropdownMenu } from "@radix-ui/themes";

export function useAddNode(reactFlowWrapper) {
  const store = useContext(RepoContext)!;
  const isAddingNode = useStore(store, (state) => state.isAddingNode);
  const setIsAddingNode = useStore(store, (state) => state.setIsAddingNode);
  const updateView = useStore(store, (state) => state.updateView);
  const updateView_addNode = useStore(
    store,
    (state) => state.updateView_addNode
  );
  const setMousePosition = useStore(store, (state) => state.setMousePosition);
  const getInsertPosition = useStore(store, (state) => state.getInsertPosition);

  const reactFlowInstance = useReactFlow();
  const addNodeAtAnchor = useStore(store, (state) => state.addNodeAtAnchor);

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
      addNodeAtAnchor("CODE");
      setIsAddingNode(false);
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
  const store = useContext(RepoContext)!;

  const moved = useStore(store, (state) => state.moved);
  const paneClicked = useStore(store, (state) => state.paneClicked);
  const nodeClicked = useStore(store, (state) => state.nodeClicked);

  const [showContextMenu, setShowContextMenu] = useState(false);

  const [points, setPoints] = useState({ x: 0, y: 0 });
  // const [client, setClient] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setShowContextMenu(false);
  }, [moved, paneClicked, nodeClicked]);
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
  const store = useContext(RepoContext)!;

  const nodes = useStore(store, (state) => state.nodes);

  const autoLayoutROOT = useStore(store, (state) => state.autoLayoutROOT);

  const importLocalCode = useStore(store, (state) => state.importLocalCode);

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

      // importLocalCode(
      //   project({ x: client.x, y: client.y }),
      //   importScopeName,
      //   cellList
      // );
      setAutoLayoutOnce(true);
    };
    fileReader.readAsText(e.target.files[0], "UTF-8");
  };

  const autoRunLayout = useStore(store, (state) => state.autoRunLayout);
  const setAutoLayoutOnce = useStore(store, (state) => state.setAutoLayoutOnce);
  const autoLayoutOnce = useStore(store, (state) => state.autoLayoutOnce);

  useEffect(() => {
    // A BIG HACK: we run autolayout once at SOME point after ImportLocalCode to
    // let reactflow calculate the height of pods, then layout them properly.
    if (
      autoLayoutOnce &&
      nodes.filter((node) => node.height === newNodeShapeConfig.height)
        .length == 0
    ) {
      autoLayoutROOT();
      setAutoLayoutOnce(false);
    }
  }, [autoLayoutOnce, nodes]);
  return { handleFileInputChange };
}

export function ContextMenu({ setShowContextMenu, handleItemClick }) {
  const store = useContext(RepoContext)!;
  const setIsAddingNode = useStore(store, (state) => state.setIsAddingNode);
  const setAddNodeType = useStore(store, (state) => state.setAddNodeType);
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
          shortcut="⌘ E"
          onClick={() => {
            setAddNodeType("CODE");
            setIsAddingNode(true);
          }}
        >
          + Code
        </DropdownMenu.Item>
        <DropdownMenu.Item
          shortcut="⌘ D"
          onClick={() => {
            setAddNodeType("RICH");
            setIsAddingNode(true);
          }}
        >
          + Doc
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
