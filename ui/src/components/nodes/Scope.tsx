import { useAtomValue, useSetAtom } from "jotai";
import { ATOM_nodesMap } from "@/lib/store/yjsSlice";
import { AppNode, ScopeNodeType } from "@/lib/store/types";
import { ATOM_addNode, ATOM_addScope } from "@/lib/store/canvasSlice";
import {
  DeleteButton,
  JavaScriptLogo,
  JuliaLogo,
  PodToolbar,
  PythonLogo,
  RacketLogo,
  SlurpButton,
  SymbolTable,
  UnslurpButton,
} from "./utils";
import { Button, DropdownMenu, Flex, IconButton } from "@radix-ui/themes";
import { Ellipsis, NotebookPen } from "lucide-react";
import { Handle, Position } from "@xyflow/react";
import { ATOM_cutId } from "@/lib/store/atom";
import { motion } from "framer-motion";
import { useState } from "react";

function ScopeToolbar({ node }: { node: ScopeNodeType }) {
  const addScope = useSetAtom(ATOM_addScope);
  const id = node.id;

  return (
    <PodToolbar id={id}>
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
        <DropdownMenu.Content>
          {/* Structural edit */}
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            onSelect={() => {
              addScope(id);
            }}
          >
            Add Scope
          </DropdownMenu.Item>
          <SlurpButton id={id} />
          <UnslurpButton id={id} />
          <DropdownMenu.Separator />
          <DeleteButton id={id} />
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </PodToolbar>
  );
}

export const ScopeNode = function ({ id }) {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);
  const cutId = useAtomValue(ATOM_cutId);
  const [hover, setHover] = useState(false);
  const addNode = useSetAtom(ATOM_addNode);
  if (!node) return null;
  if (node.type !== "SCOPE") throw new Error("Invalid node type");
  // node.data.scopeChildren
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        border: cutId === id ? "3px dashed red" : "3px solid transparent",
        backgroundColor: "rgba(0, 0, 255, 0.05)",
      }}
      className="nodrag"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <motion.div
        animate={{
          opacity: hover ? 1 : 0,
        }}
      >
        <ScopeToolbar node={node} />
      </motion.div>
      <Handle id="left" type="source" position={Position.Left} />
      <Handle id="right" type="source" position={Position.Right} />
      <SymbolTable id={id} />
      {node.data.podFolded && (
        <Flex align="center" justify="center">
          {/* FIXME This is the number of direct children. We should show the number of all descendants. */}
          {node.data.scopeChildrenIds.length} pods folded
        </Flex>
      )}
      {!node.data.podFolded && node.data.scopeChildrenIds.length === 0 && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            style={{
              // align to the center
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <Button variant="outline">+</Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content variant="soft">
            <DropdownMenu.Item
              shortcut="⌘ D"
              onSelect={() => {
                addNode({ anchorId: id, position: "in", type: "RICH" });
              }}
            >
              <NotebookPen /> Doc
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              shortcut="⌘ E"
              onSelect={() => {
                addNode({
                  anchorId: id,
                  position: "in",
                  type: "CODE",
                  lang: "python",
                });
              }}
            >
              <PythonLogo /> Python
            </DropdownMenu.Item>
            <DropdownMenu.Item
              shortcut="⌘ E"
              onSelect={() => {
                addNode({
                  anchorId: id,
                  position: "in",
                  type: "CODE",
                  lang: "julia",
                });
              }}
            >
              <JuliaLogo /> Julia
            </DropdownMenu.Item>

            <DropdownMenu.Item
              shortcut="⌘ E"
              onSelect={() => {
                addNode({
                  anchorId: id,
                  position: "in",
                  type: "CODE",
                  lang: "javascript",
                });
              }}
            >
              <JavaScriptLogo /> JavaScript
            </DropdownMenu.Item>

            <DropdownMenu.Item
              shortcut="⌘ E"
              onSelect={() => {
                addNode({
                  anchorId: id,
                  position: "in",
                  type: "CODE",
                  lang: "racket",
                });
              }}
            >
              <RacketLogo /> Racket
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      )}
    </div>
  );
};
