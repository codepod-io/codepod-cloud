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

import { useStore } from "zustand";

import { RepoContext } from "@/lib/store";

import { MyMonaco } from "../MyMonaco";

import { Handles } from "./utils";
import { timeDifference } from "@/lib/utils/utils";

import { runtimeTrpc, trpc } from "@/lib/trpc";
import { DropdownMenu, Flex, Button as RadixButton } from "@radix-ui/themes";
import { Check, Play, X } from "lucide-react";
import { CaretDownIcon } from "@radix-ui/react-icons";

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

  const store = useContext(RepoContext)!;
  const clearResults = useStore(store, (state) => state.clearResults);
  // monitor result change
  // FIXME performance: would this trigger re-render of all pods?
  const resultChanged = useStore(store, (state) => state.resultChanged[id]);
  // This is a dummy useEffect to indicate resultChanged is used.
  useEffect(() => {}, [resultChanged]);
  const resultMap = useStore(store, (state) => state.getResultMap());
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
          backgroundColor: "var(--accent-5)",
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
              <RadixButton variant="classic" size="1">
                Menu
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
        }}
      >
        {results &&
          results.length > 0 &&
          results.map((res, i) => {
            const combinedKey = `${res.type}-${i}`;
            switch (res.type) {
              case "stream_stdout":
                return (
                  <Box
                    component="pre"
                    whiteSpace="pre-wrap"
                    key={combinedKey}
                    sx={{ fontSize: "0.8em", margin: 0, padding: 0 }}
                  >
                    <Ansi>{res.text}</Ansi>
                  </Box>
                );
              case "stream_stderr":
                return (
                  <Box
                    component="pre"
                    whiteSpace="pre-wrap"
                    key={combinedKey}
                    sx={{ fontSize: "0.8em", margin: 0, padding: 0 }}
                  >
                    <Ansi>{res.text}</Ansi>
                  </Box>
                );
              case "display_data":
                // TODO html results
                return (
                  <Box component="pre" whiteSpace="pre-wrap" key={combinedKey}>
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
                  </Box>
                );
              case "execute_result":
                return (
                  <Box
                    component="pre"
                    whiteSpace="pre-wrap"
                    key={combinedKey}
                    sx={{
                      fontSize: "0.8em",
                      margin: 0,
                      padding: 0,
                      borderTop: "1px solid rgb(214, 222, 230)",
                    }}
                  >
                    {res.text}
                    {res.html && (
                      <div dangerouslySetInnerHTML={{ __html: res.html }} />
                    )}
                  </Box>
                );
              default:
                return <Box key="unknown">[WARN] Unknown Result</Box>;
            }
          })}

        {error && <Box color="red">{error?.evalue}</Box>}
        {error?.stacktrace && error?.stacktrace.length > 0 && (
          <Box>
            <Box>StackTrace</Box>
            <Box whiteSpace="pre-wrap" sx={{ fontSize: "0.8em" }}>
              <Ansi>{error.stacktrace.join("\n")}</Ansi>
            </Box>
          </Box>
        )}
      </div>
    </div>
  );
});

function HeaderBar({ id }: { id: string }) {
  const store = useContext(RepoContext)!;
  const reactFlowInstance = useReactFlow();
  const preprocessChain = useStore(store, (state) => state.preprocessChain);
  const getEdgeChain = useStore(store, (state) => state.getEdgeChain);
  const runChain = runtimeTrpc.kernel.runChain.useMutation();
  const activeRuntime = useStore(store, (state) => state.activeRuntime);

  return (
    <div
      className="custom-drag-handle"
      style={{
        height: "var(--space-6)",
        backgroundColor: "var(--accent-8)",
        border: "solid 1px var(--gray-12)",
        borderRadius: "4px 4px 0 0",
        cursor: "grab",
        display: "flex",
        alignItems: "center",
        padding: "0 10px",
      }}
    >
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <RadixButton variant="classic" size="1">
            Menu
            <CaretDownIcon />
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
      <div className="flex-grow"></div>
      <RadixButton
        variant="classic"
        size="1"
        onClick={() => {
          if (activeRuntime) {
            const specs = preprocessChain([id]);
            if (specs) runChain.mutate({ runtimeId: activeRuntime, specs });
          }
        }}
      >
        Run
        <Play size="10" />
      </RadixButton>
    </div>
  );
}

export const CodeNode = memo<NodeProps>(function ({
  data,
  id,
  selected,
  // note that xPos and yPos are the absolute position of the node
  xPos,
  yPos,
}) {
  const store = useContext(RepoContext)!;
  const setPodName = useStore(store, (state) => state.setPodName);
  const inputRef = useRef<HTMLInputElement>(null);

  const nodesMap = useStore(store, (state) => state.getNodesMap());
  useEffect(() => {
    if (!data.name) return;
    setPodName({ id, name: data.name });
    if (inputRef?.current) {
      inputRef.current.value = data.name || "";
    }
  }, [data.name, setPodName, id]);

  const node = nodesMap.get(id);
  if (!node) return null;

  return (
    <div
      // className="nodrag"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        minWidth: "300px",
        // This is the key to let the node auto-resize w.r.t. the content.
        height: "auto",
        // minHeight: "50px",
        // border: "solid 1px black",
        backgroundColor: "white",
      }}
    >
      <HeaderBar id={id} />
      <div
        style={{
          backgroundColor: "var(--accent-2)",
          // minHeight: "60px",
          border: "solid 1px var(--gray-12)",
          borderRadius: "0 0 4px 4px",
        }}
      >
        <MyMonaco id={id} />
      </div>
      <ResultBlock id={id} />
      <Handles
        width={node.width}
        height={node.height}
        parent={node.parentNode}
        xPos={xPos}
        yPos={yPos}
      />
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
  );
});
