import {
  useCallback,
  useState,
  useRef,
  useContext,
  useEffect,
  memo,
} from "react";
import * as React from "react";
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  MiniMap,
  Controls,
  Handle,
  useReactFlow,
  Position,
  ConnectionMode,
  MarkerType,
  Node,
  NodeProps,
  useStore as useReactFlowStore,
  NodeResizeControl,
} from "reactflow";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import HeightIcon from "@mui/icons-material/Height";

import Ansi from "ansi-to-react";

import { MyMonaco } from "../MyMonaco";

import { Handles, useAnchorStyle } from "./utils";
import { timeDifference } from "@/lib/utils/utils";

import { runtimeTrpc, trpc } from "@/lib/trpc";
import {
  DropdownMenu,
  Flex,
  Button as RadixButton,
  Select,
} from "@radix-ui/themes";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  FunctionSquare,
  MoreHorizontal,
  Pencil,
  Play,
  X,
} from "lucide-react";
import { CaretDownIcon } from "@radix-ui/react-icons";
import { match } from "ts-pattern";
import { useAtom, useSetAtom } from "jotai";
import { selectAtom } from "jotai/utils";
import {
  ATOM_activeRuntime,
  ATOM_clearResults,
  ATOM_getEdgeChain,
  ATOM_preprocessChain,
} from "@/lib/store/runtimeSlice";
import {
  ATOM_changeLang,
  ATOM_nodesMap,
  ATOM_podUpdated,
  ATOM_resultChanged,
  ATOM_resultMap,
} from "@/lib/store/yjsSlice";
import { ATOM_addNode, ATOM_autoLayoutTree } from "@/lib/store/canvasSlice";

function Timer({ lastExecutedAt }) {
  const [counter, setCounter] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setCounter(counter + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [counter]);
  return <div> at {timeDifference(new Date(), new Date(lastExecutedAt))}</div>;
}

export const ResultBlock = memo<any>(function ResultBlock({ id }) {
  const [resultScroll, setResultScroll] = useState(false);

  const clearResults = useSetAtom(ATOM_clearResults);
  // monitor result change
  useAtom(
    React.useMemo(() => selectAtom(ATOM_resultChanged, (v) => v[id]), [id])
  );

  const [resultMap] = useAtom(ATOM_resultMap);
  const result = resultMap.get(id);
  if (!result) {
    return null;
  }
  const results = result.data;
  const error = result.error;
  const running = result.running;
  const exec_count = result.exec_count;

  const lastExecutedAt = result.lastExecutedAt;

  return (
    <div
      style={{
        userSelect: "text",
        cursor: "auto",
      }}
      // If the result is focused, we can scroll inside the result box, but no
      // longer pan the canvas.
      // DEPRECATED. Now we just use a force-displayed scrollbar.
      className={resultScroll ? "nowheel" : ""}
    >
      {/* result header */}
      <div
        className="px-1 flex space-x-2"
        style={{
          backgroundColor: "var(--accent-3)",
          height: "var(--space-6)",
          alignItems: "center",
        }}
      >
        <>
          {exec_count && (
            <Box
              sx={{
                color: "var(--gray-9)",
                textAlign: "left",
                paddingLeft: "5px",
              }}
            >
              [{exec_count}]
            </Box>
          )}
          {error ? <X color="red" /> : <Check color="green" />}
          {lastExecutedAt && <Timer lastExecutedAt={lastExecutedAt} />}
          {running && <CircularProgress />}
          <Flex grow="1" />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <RadixButton variant="ghost" size="1">
                <CaretDownIcon />
              </RadixButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item
                onClick={() => {
                  setResultScroll(!resultScroll);
                }}
                disabled
              >
                Focus
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() => {
                  clearResults(id);
                }}
                color="red"
              >
                Clear
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </>
      </div>
      {/* result content */}
      <div
        // Force display vertical scrollbar. Styles defined in custom.css.
        className="result-content"
        style={{
          backgroundColor: "var(--accent-2)",
          maxHeight: "200px",
          overflow: "scroll",
          fontSize: "0.8em",
          padding: "0 5px",
          whiteSpace: "pre-wrap",
        }}
      >
        {results &&
          results.length > 0 &&
          results.map((res, i) => {
            const combinedKey = `${res.type}-${i}`;
            switch (res.type) {
              case "stream_stdout":
                return (
                  <div key={combinedKey} style={{}}>
                    <Ansi>{res.text}</Ansi>
                  </div>
                );
              case "stream_stderr":
                return (
                  <div key={combinedKey}>
                    <Ansi>{res.text}</Ansi>
                  </div>
                );
              case "display_data":
                // TODO html results
                return (
                  <div key={combinedKey}>
                    {res.text}
                    {res.html && (
                      <div dangerouslySetInnerHTML={{ __html: res.html }} />
                    )}
                    {res.image && (
                      <img
                        src={`data:image/png;base64,${res.image}`}
                        alt="output"
                      />
                    )}
                  </div>
                );
              case "execute_result":
                return (
                  <div
                    key={combinedKey}
                    style={{
                      borderTop: "1px solid rgb(214, 222, 230)",
                    }}
                  >
                    {res.text}
                    {res.html && (
                      <div dangerouslySetInnerHTML={{ __html: res.html }} />
                    )}
                  </div>
                );
              default:
                return <Box key="unknown">[WARN] Unknown Result</Box>;
            }
          })}

        {error && <Box color="red">{error?.evalue}</Box>}
        {error?.stacktrace && error?.stacktrace.length > 0 && (
          <Box>
            <Box>StackTrace</Box>
            <Ansi>{error.stacktrace.join("\n")}</Ansi>
          </Box>
        )}
      </div>
    </div>
  );
});

function HeaderBar({ id }: { id: string }) {
  const reactFlowInstance = useReactFlow();
  const preprocessChain = useSetAtom(ATOM_preprocessChain);
  const getEdgeChain = useSetAtom(ATOM_getEdgeChain);
  const changeLang = useSetAtom(ATOM_changeLang);

  const runChain = runtimeTrpc.kernel.runChain.useMutation();
  const [activeRuntime] = useAtom(ATOM_activeRuntime);
  const [nodesMap] = useAtom(ATOM_nodesMap);
  const addNode = useSetAtom(ATOM_addNode);
  const node = nodesMap.get(id)!;
  const parentId = node.data.parent;
  let index = 0;
  if (parentId) {
    const parentNode = nodesMap.get(parentId);
    index = parentNode?.data.children?.indexOf(id)!;
  }

  return (
    <div
      // className="custom-drag-handle"
      style={{
        height: "var(--space-6)",
        backgroundColor: "var(--accent-3)",
        borderRadius: "4px 4px 0 0",
        cursor: "auto",
        display: "flex",
        alignItems: "center",
        padding: "0 10px",
      }}
    >
      <div className="flex-grow"></div>

      {/* Language selector */}
      <Select.Root
        value={node.data.lang}
        onValueChange={(value) => {
          changeLang(id, value);
        }}
      >
        <Select.Trigger variant="ghost" />
        <Select.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault();
          }}
        >
          <Select.Group>
            <Select.Label>Languages</Select.Label>
            <Select.Item value="python">Python</Select.Item>
            <Select.Item value="markdown">Markdown</Select.Item>
          </Select.Group>
          <Select.Separator />
          <Select.Group>
            <Select.Label>Configs</Select.Label>
            <Select.Item value="dockerfile">Dockerfile</Select.Item>
          </Select.Group>
        </Select.Content>
      </Select.Root>
      <RadixButton
        variant="ghost"
        style={{
          margin: 0,
        }}
        onClick={() => {
          if (activeRuntime) {
            const specs = preprocessChain([id]);
            if (specs) runChain.mutate({ runtimeId: activeRuntime, specs });
          }
        }}
      >
        <Play size={15} />
      </RadixButton>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <RadixButton
            variant="ghost"
            style={{
              margin: 0,
            }}
          >
            <MoreHorizontal size={15} />
          </RadixButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item
            shortcut="⇧ ⏎"
            onClick={() => {
              if (activeRuntime) {
                const specs = preprocessChain([id]);
                if (specs) runChain.mutate({ runtimeId: activeRuntime, specs });
              }
            }}
          >
            Run
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onClick={() => {
              if (activeRuntime) {
                const chain = getEdgeChain(id);
                const specs = preprocessChain(chain);
                if (specs) runChain.mutate({ runtimeId: activeRuntime, specs });
              }
            }}
          >
            Run Chain
          </DropdownMenu.Item>

          <DropdownMenu.Separator />
          <DropdownMenu.Item
            shortcut="⌘ ⌫"
            color="red"
            onClick={() => {
              // Delete all edges connected to the node.
              reactFlowInstance.deleteElements({ nodes: [{ id }] });
            }}
          >
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  );
}

/**
 * Hover on the handle and show different variants.
 */
function HandleWithHover({ id }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Handles id={id} hover={hover} />
    </div>
  );
}

export const CodeNode = memo<{ id: string }>(function ({ id }) {
  // Re-render the editor when the pod is updated (e.g., language changed).
  useAtom(React.useMemo(() => selectAtom(ATOM_podUpdated, (v) => v[id]), [id]));
  const [nodesMap] = useAtom(ATOM_nodesMap);

  const autoLayoutTree = useSetAtom(ATOM_autoLayoutTree);

  const anchorStyle = useAnchorStyle(id);

  const node = nodesMap.get(id);
  if (!node) return null;

  return (
    <div
      // className="nodrag"
      style={{
        ...anchorStyle,
        width: "100%",
        minWidth: "300px",
        // This is the key to let the node auto-resize w.r.t. the content.
        height: "auto",
        // minHeight: "50px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",

          // border: "solid 1px black",
          backgroundColor: "white",
          border: "solid 1px var(--gray-12)",

          // NOTE: monaco editor has a overflow-guard that doesn't have border
          // radius on the bottom. So we don't apply the border-radius on the
          // bottom to avoid inconsistent looking.
          borderRadius: "4px 4px 0 0",
        }}
      >
        <HeaderBar id={id} />
        <div
          style={{
            paddingTop: "5px",
            cursor: "auto",
          }}
        >
          <MyMonaco id={id} />
        </div>
        <ResultBlock id={id} />

        <HandleWithHover id={id} />

        <NodeResizeControl
          style={{
            background: "transparent",
            border: "none",
            // make it above the pod
            zIndex: 100,
            // put it to the right-bottom corner, instead of right-middle.
            top: "100%",
            color: "red",
          }}
          minWidth={300}
          minHeight={50}
          // this allows the resize happens in X-axis only.
          position="right"
          onResizeEnd={() => {
            // remove style.height so that the node auto-resizes.
            const node = nodesMap.get(id);
            if (node) {
              nodesMap.set(id, {
                ...node,
                style: { ...node.style, height: undefined },
              });
              autoLayoutTree();
            }
          }}
        >
          <HeightIcon
            sx={{
              transform: "rotate(90deg)",
              position: "absolute",
              right: 5,
              bottom: 5,
            }}
          />
        </NodeResizeControl>
      </div>
    </div>
  );
});
