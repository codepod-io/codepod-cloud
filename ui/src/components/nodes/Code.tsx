import {
  useCallback,
  useState,
  useRef,
  useContext,
  useEffect,
  memo,
} from "react";
import * as React from "react";
import { useReactFlow, NodeResizeControl } from "reactflow";

import { useHotkeys } from "react-hotkeys-hook";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import HeightIcon from "@mui/icons-material/Height";

import Ansi from "ansi-to-react";

import { MyMonaco } from "../MyMonaco";

import { Handles, useAnchorStyle } from "./utils";
import { timeDifference } from "@/lib/utils/utils";

import { runtimeTrpc, trpc } from "@/lib/trpc";
import { DropdownMenu, Flex, IconButton, Select } from "@radix-ui/themes";
import { Check, Ellipsis, Play, X } from "lucide-react";
import { CaretDownIcon } from "@radix-ui/react-icons";
import { match } from "ts-pattern";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { selectAtom } from "jotai/utils";
import {
  ATOM_clearResults,
  ATOM_getEdgeChain,
  ATOM_preprocessChain,
} from "@/lib/store/runtimeSlice";
import {
  ATOM_nodesMap,
  ATOM_resultChanged,
  ATOM_resultMap,
  ATOM_runtimeReady,
} from "@/lib/store/yjsSlice";
import { ATOM_autoLayoutTree } from "@/lib/store/canvasSlice";
import { ATOM_repoId } from "@/lib/store/atom";
import { useSnackbar } from "notistack";

import juliaLogo from "@/assets/julia.svg";
import pythonLogo from "@/assets/python.svg";
import javascriptLogo from "@/assets/javascript.svg";
import racketLogo from "@/assets/racket.svg";

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
          <Flex flexGrow="1" />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <IconButton variant="ghost" size="1">
                <CaretDownIcon />
              </IconButton>
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
                    {res.html ? (
                      <div dangerouslySetInnerHTML={{ __html: res.html }} />
                    ) : (
                      // sometimes (e.g., in racket), both text and html are
                      // set. In this case, we just show the html.
                      res.text
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

  const runChain = runtimeTrpc.k8s.runChain.useMutation();
  const lang = useAtomValue(ATOM_nodesMap).get(id)?.data.lang;
  const runtimeReady =
    lang &&
    useAtomValue(
      React.useMemo(() => selectAtom(ATOM_runtimeReady, (v) => v[lang]), [id])
    );
  const repoId = useAtomValue(ATOM_repoId)!;
  const [nodesMap] = useAtom(ATOM_nodesMap);
  const node = nodesMap.get(id)!;
  const parentId = node.data.parent;
  let index = 0;
  if (parentId) {
    const parentNode = nodesMap.get(parentId);
    index = parentNode?.data.children?.indexOf(id)!;
  }

  return (
    <Flex>
      <IconButton
        variant="ghost"
        radius="full"
        style={{
          margin: 0,
        }}
        disabled={!runtimeReady}
        onClick={() => {
          const specs = preprocessChain([id]);
          if (specs) runChain.mutate({ repoId, specs });
        }}
      >
        <Play size="1.2em" />
      </IconButton>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <IconButton
            variant="ghost"
            radius="full"
            style={{
              margin: 0,
            }}
          >
            <Ellipsis size="1.2em" />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item
            shortcut="⇧ ⏎"
            onClick={() => {
              const specs = preprocessChain([id]);
              if (specs) runChain.mutate({ repoId, specs });
            }}
            disabled={!runtimeReady}
          >
            Run
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={!runtimeReady}
            onClick={() => {
              const chain = getEdgeChain(id);
              const specs = preprocessChain(chain);
              if (specs) runChain.mutate({ repoId, specs });
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
    </Flex>
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

/**
 * Listen to Shift+Enter key press and run the code.
 * @param id the ID of the pod.
 * @returns a ref to be attached to a React component so that the hotkey is
 * bound to that pod.
 */
function useRunKey({ id }: { id: string }) {
  // The runtime ATOMs and trpc APIs.
  const runChain = runtimeTrpc.k8s.runChain.useMutation();
  const preprocessChain = useSetAtom(ATOM_preprocessChain);
  const lang = useAtomValue(ATOM_nodesMap).get(id)?.data.lang;
  const runtimeReady =
    lang &&
    useAtom(
      React.useMemo(() => selectAtom(ATOM_runtimeReady, (v) => v[lang]), [id])
    );
  const repoId = useAtomValue(ATOM_repoId)!;
  const { enqueueSnackbar } = useSnackbar();
  // call useHotKeys library
  return useHotkeys<HTMLDivElement>(
    "shift+enter",
    () => {
      if (!runtimeReady) {
        enqueueSnackbar("Runtime is not ready.", { variant: "error" });
      } else {
        const specs = preprocessChain([id]);
        if (specs) runChain.mutate({ repoId, specs });
      }
    },
    {
      enableOnContentEditable: true,
      enabled: true,
      // So that it works on the code editor.
      enableOnFormTags: ["INPUT", "TEXTAREA"],
      // Prevent inserting in the code editor.
      preventDefault: true,
    },
    [runtimeReady]
  );
}

export const CodeNode = memo<{ id: string }>(function ({ id }) {
  const [nodesMap] = useAtom(ATOM_nodesMap);

  const autoLayoutTree = useSetAtom(ATOM_autoLayoutTree);

  const [hover, setHover] = useState(false);

  const anchorStyle = useAnchorStyle(id);
  let ref = useRunKey({ id })!;

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
      ref={ref}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",

          // border: "solid 1px black",
          backgroundColor: "white",
          border: "solid 1px var(--gray-12)",

          // NOTE: monaco editor has a overflow-guard that needs to have border
          // radius as well. See .overflow-guard and .monaco-editor in
          // custom.css.
          borderRadius: "4px",
        }}
      >
        {hover && (
          <Box
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              zIndex: 100,
            }}
          >
            <HeaderBar id={id} />
          </Box>
        )}
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

        <Box
          style={{
            position: "fixed",
            bottom: "8px",
            right: hover ? "30px" : "8px",
          }}
        >
          {/* .py */}
          {match(node.data.lang)
            .with("python", () => (
              <img
                src={pythonLogo}
                style={{
                  height: "1em",
                }}
              />
            ))
            .with("julia", () => (
              <img
                src={juliaLogo}
                style={{
                  height: "1em",
                }}
              />
            ))
            .with("javascript", () => (
              <img
                src={javascriptLogo}
                style={{
                  height: "1em",
                }}
              />
            ))
            .with("racket", () => (
              <img
                src={racketLogo}
                style={{
                  height: "1em",
                }}
              />
            ))
            .otherwise(() => "??")}{" "}
        </Box>

        {hover && (
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
        )}
      </div>
    </div>
  );
});
