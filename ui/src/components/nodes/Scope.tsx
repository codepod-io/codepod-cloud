import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ATOM_nodesMap,
  ATOM_provider,
  ATOM_richMap,
} from "@/lib/store/yjsSlice";
import { AppNode } from "@/lib/store/types";

import * as Y from "yjs";
import {
  Handle,
  NodeProps,
  NodeResizeControl,
  NodeResizer,
  Position,
  useConnection,
  useReactFlow,
  useStore,
  XYPosition,
} from "@xyflow/react";
import { Box, Button, DropdownMenu, Flex, IconButton } from "@radix-ui/themes";
import { myassert } from "@/lib/utils/utils";
import {
  ATOM_collisionIds,
  ATOM_escapedIds,
  ATOM_insertMode,
  ATOM_toggleFold,
  getAbsPos,
} from "@/lib/store/canvasSlice";
import { ChangeScopeItem, MyHandle } from "./Code";
import { memo, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Copy,
  Ellipsis,
  Eye,
  EyeOff,
  GripVertical,
  Trash2,
} from "lucide-react";
import { css } from "@emotion/css";
import { ConfirmedDelete, SymbolTable } from "./utils";
import {
  ATOM_deleteScope,
  ATOM_deleteSubTree,
  ATOM_duplicateScope,
} from "@/lib/store/canvasSlice_addNode";
import {
  getOrCreate_ATOM_privateST,
  getOrCreate_ATOM_publicST,
} from "@/lib/store/runtimeSlice";
import { RichEditor } from "./Rich_Editor";

const MyToolbar = memo(function MyToolbar({ id }: { id: string }) {
  const zoom = useStore((s) => Math.max(s.transform[2], 0.1));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        position: "absolute",
        top: 0,
        right: 0,
        // border: "solid 1px var(--gray-8)",
        transform: `translate(0%, -100%) scale(${1 / zoom})`,
        transformOrigin: "bottom right",
        backgroundColor: "white",
        borderRadius: "5px",
        boxShadow: "0 0 10px rgba(0,0,0,0.2)",
        cursor: "auto",
      }}
    >
      <MyToolbarImpl id={id} />
    </div>
  );
});

const MyToolbarImpl = memo(function MyToolbarImpl({ id }: { id: string }) {
  const deleteScope = useSetAtom(ATOM_deleteScope);
  const deleteSubTree = useSetAtom(ATOM_deleteSubTree);
  const duplicateScope = useSetAtom(ATOM_duplicateScope);
  const toggleFold = useSetAtom(ATOM_toggleFold);
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);
  myassert(node);
  myassert(node.type === "SCOPE");
  // FIXME this component does not monitor folding status.
  // useEffect(() => {}, [node?.data.folded]);
  return (
    <>
      {/* drag handle */}
      <Box
        className="custom-drag-handle"
        style={{
          cursor: "grab",
          padding: "8px",
          display: "inline-flex",
        }}
      >
        <GripVertical />
      </Box>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <IconButton
            variant="ghost"
            radius="small"
            style={{
              margin: 3,
              padding: 0,
            }}
          >
            <Ellipsis />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content color="yellow">
          <ChangeScopeItem id={id} />
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            onSelect={() => {
              toggleFold(id);
            }}
          >
            {node.data.folded ? (
              <>
                <EyeOff />
                Toggle Fold
              </>
            ) : (
              <>
                <Eye /> Toggle Fold
              </>
            )}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => {
              duplicateScope(id);
            }}
          >
            <Copy /> Duplicate
          </DropdownMenu.Item>
          <ConfirmedDelete
            color="red"
            onSelect={() => {
              deleteScope(id);
            }}
            trigger={
              <>
                <Trash2 /> Remove Scope
              </>
            }
            title="This will delete the scope but keep its children."
            description="Continue?"
            confirm="Delete"
          />
          <ConfirmedDelete
            color="red"
            onSelect={() => {
              deleteSubTree(id);
            }}
            trigger={
              <>
                <Trash2 /> Delete Scope and All Pods
              </>
            }
            title="This will delete the scope AND delete all the pods inside it."
            description="Continue?"
            confirm="Delete"
          />
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </>
  );
});

const RichEditorWrapper = memo(({ id }: { id: string }) => {
  // the Yjs extension for Remirror
  const [provider] = useAtom(ATOM_provider);

  const [richMap] = useAtom(ATOM_richMap);
  if (!richMap.has(id)) {
    throw new Error("richMap does not have id " + id);
  }
  const yXml = richMap.get(id);
  if (!yXml) return null;
  if (!provider) return null;
  return <RichEditor yXml={yXml} provider={provider} id={id} />;
});

export const ScopeNode = memo(function ScopeNode({ id }: NodeProps) {
  return <ScopeNodeImpl id={id} />;
});

export const ScopeNodeImpl = memo(function ScopeNodeImpl({
  id,
}: {
  id: string;
}) {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);

  const [hover, setHover] = useState(false);

  const insertMode = useAtomValue(ATOM_insertMode);

  const connection = useConnection();

  const isTarget = connection.inProgress && connection.fromNode.id !== id;

  // collisions
  const collisionIds = useAtomValue(ATOM_collisionIds);
  const escapedIds = useAtomValue(ATOM_escapedIds);

  const toggleFold = useSetAtom(ATOM_toggleFold);

  const borderWidth = 4;

  if (!node) return null;
  myassert(node.type === "SCOPE");

  return (
    <Box
      style={{
        width: node.data.mywidth,
        height: node.data.myheight,
        // styling
        borderWidth: `${borderWidth}px`,
        borderStyle: "solid",
        borderColor: escapedIds.includes(id)
          ? "orange"
          : collisionIds.includes(id)
            ? "pink"
            : "gray",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {insertMode === "Move" && (
        <Box
          className="custom-drag-handle"
          style={{
            pointerEvents: "all",
            // put it on top of Monaco
            // zIndex: 10,
            // make it full width of the node
            position: "absolute",
            width: "100%",
            height: "100%",
            top: 0,
            left: 0,
            opacity: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          Drag to move
        </Box>
      )}
      <Flex
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: "translate(0, -100%)",
        }}
      >
        {" "}
        Scope {id}
      </Flex>
      {node.data.folded ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "1em",
            alignItems: "center",
            opacity: 1,
            backgroundColor: "lightblue",
            // This is full height and set the background color.
            width: "100%",
            height: "100%",
            pointerEvents: "all",
          }}
        >
          <Flex
            direction={"column"}
            align="center"
            gap="2"
            style={{
              // The components of this flex will be scaled for visibility.
              transform: `scale(${((node.data.mywidth ?? 600) * 1) / 800})`,
              pointerEvents: "all",
            }}
          >
            {/* README if any */}
            {node.data.childrenIds.map((childId) => {
              const childNode = nodesMap.get(childId);
              if (!childNode) return null;
              if (childNode.data.isReadme) {
                myassert(childNode.type === "RICH");
                return (
                  <div
                    key={childId}
                    style={{
                      display: "flex",
                    }}
                  >
                    <RichEditorWrapper id={childId} />
                  </div>
                );
              }
              return null;
            })}
            <Button
              onClick={() => {
                toggleFold(id);
              }}
            >
              <EyeOff /> Unfold
            </Button>
            Number of pods: {node.data.childrenIds.length}
            <FoldedSymbolTable id={id} />
          </Flex>
        </div>
      ) : (
        <Flex
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "lightblue",
            opacity: 0.1,
          }}
        ></Flex>
      )}
      <Box
        style={{
          pointerEvents: "all",
        }}
      >
        <SymbolTable id={id} />
      </Box>
      <MyHandle hover={hover} isTarget={isTarget} />
      {/* THIS motion.div has a big performance hit. */}
      {/* <motion.div
        animate={{
          opacity: hover ? 1 : 0,
        }}
        style={{
          pointerEvents: "all",
        }}
      >
        <MyToolbar id={id} />
      </motion.div> */}
      <div
        style={{
          pointerEvents: "all",
          opacity: hover ? 1 : 0,
        }}
      >
        <MyToolbar id={id} />
      </div>
      <MyNodeResizer borderWidth={borderWidth} />
    </Box>
  );
});

const FoldedSymbolTable = memo(function FoldedSymbolTable({
  id,
}: {
  id: string;
}) {
  const privateSt = useAtomValue(getOrCreate_ATOM_privateST(id));
  const publicSt = useAtomValue(getOrCreate_ATOM_publicST(id));
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);
  const reactFlowInstance = useReactFlow();
  if (!node) throw new Error(`Node ${id} not found.`);
  return (
    <Box>
      {/* LEFT: show public ST of this scope. */}
      <Box
        style={{
          color: "green",
        }}
      >
        {[...publicSt.keys()].slice(0, 20).map((key) => (
          <Flex align="center" key={key}>
            <Button
              onClick={() => {
                // jump to the node
                const targetId = publicSt.get(key);
                myassert(targetId);
                const targetNode = nodesMap.get(targetId);
                if (!targetNode) return;
                const pos = getAbsPos(targetNode, nodesMap);
                reactFlowInstance.setCenter(
                  pos.x + (targetNode.measured?.width || 0) / 2,
                  pos.y + (targetNode.measured?.height || 0) / 2,
                  {
                    zoom: reactFlowInstance.getZoom(),
                    duration: 800,
                  }
                );
              }}
              variant="ghost"
              style={{
                fontSize: "inherit",
                padding: "0.5em 1em",
                color: "inherit",
              }}
            >
              <code>{key}</code>
            </Button>
          </Flex>
        ))}
        {[...publicSt.keys()].slice(20).length > 0 && (
          <Flex align="center">
            <Button
              style={{
                fontSize: "inherit",
                padding: "0.5em 1em",
                color: "inherit",
              }}
              variant="ghost"
            >
              <code>...({[...publicSt.keys()].slice(20).length} more)</code>
            </Button>
          </Flex>
        )}
      </Box>
      {/* RIGHT: show private ST of this scope. */}
      <Flex wrap="wrap" direction="column">
        {[...privateSt.keys()].slice(0, 20).map((key) => (
          <Flex align="center" key={key}>
            <Button
              onClick={() => {
                // jump to the node
                const targetId = privateSt.get(key)!;
                const targetNode = nodesMap.get(targetId);
                if (!targetNode) return;
                const pos = getAbsPos(targetNode, nodesMap);
                reactFlowInstance.setCenter(
                  pos.x + (targetNode.measured?.width || 0) / 2,
                  pos.y + (targetNode.measured?.height || 0) / 2,
                  {
                    zoom: reactFlowInstance.getZoom(),
                    duration: 800,
                  }
                );
              }}
              variant="ghost"
              style={{ fontSize: "inherit", padding: "0.5em 1em" }}
            >
              <code>{key}</code>
            </Button>
          </Flex>
        ))}
        {[...privateSt.keys()].slice(20).length > 0 && (
          <Flex align="center">
            <Button
              style={{
                fontSize: "inherit",
                padding: "0.5em 1em",
              }}
              variant="ghost"
            >
              <code>...({[...privateSt.keys()].slice(20).length} more)</code>
            </Button>
          </Flex>
        )}
      </Flex>
    </Box>
  );
});

const MyNodeResizer = memo(function borderWidth({
  borderWidth,
}: {
  borderWidth: number;
}) {
  return (
    <Box
      style={{
        pointerEvents: "all",
      }}
      className={css`
          .line.right {
            width: 20px;
            border-width: 0px;
            background-color: pink;

            // border-right-width: 10px;
            // the 3px here is 1/2 of the scope border 6px
            transform: translateX(-50%) translateX(-${borderWidth / 2}px);
          }
          .line.bottom {
            height: 20px;
            background-color: pink;
            // border-bottom-width: 10px;
            transform: translateY(-50%) translateY(-${borderWidth / 2}px);
          }
          .line.left {
            width: 20px;
            background-color: pink;
            border-left-width: 0px;
            transform: translateX(-50%) translateX(${borderWidth / 2}px);
          }
          .line.top {
            height: 20px;
            background-color: pink;
            border-top-width: 0px;
            transform: translateY(-50%) translateY(${borderWidth / 2}px);
          }
          .handle.top.right {
            transform: translate(-50%, -50%) translate(-${borderWidth / 2}px, ${borderWidth / 2}px);
          }
          .handle.top.left {
            transform: translate(-50%, -50%) translate(${borderWidth / 2}px, ${borderWidth / 2}px);
          }
          .handle.bottom.right {
            transform: translate(-50%, -50%) translate(-${borderWidth / 2}px, -${borderWidth / 2}px);
          }
          .handle.bottom.left {
            transform: translate(-50%, -50%) translate(${borderWidth / 2}px, -${borderWidth / 2}px);
        `}
    >
      <NodeResizer
        minWidth={100}
        minHeight={30}
        handleStyle={{
          // borderWidth: "5px",
          width: "10px",
          height: "10px",
          // border: "10px solid",
          opacity: 0,
        }}
        lineStyle={{
          opacity: 0,
        }}
      />
    </Box>
  );
});
