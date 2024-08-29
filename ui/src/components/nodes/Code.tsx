import {
  useCallback,
  useState,
  useRef,
  useContext,
  useEffect,
  memo,
} from "react";
import * as React from "react";
import {
  useReactFlow,
  NodeResizeControl,
  NodeProps,
  Handle,
  Position,
} from "@xyflow/react";
import { ResizeControlVariant } from "@xyflow/react";

import { useHotkeys } from "react-hotkeys-hook";

import Ansi from "ansi-to-react";

import { MyMonaco } from "../MyMonaco";

import {
  DeleteButton,
  Handles,
  PodToolbar,
  SlurpButton,
  SymbolTable,
  ToolbarAddPod,
  UnslurpButton,
} from "./utils";
import { timeDifference } from "@/lib/utils/utils";

import { runtimeTrpc, trpc } from "@/lib/trpc";
import {
  Box,
  Button,
  Dialog,
  DropdownMenu,
  Flex,
  IconButton,
  Spinner,
} from "@radix-ui/themes";
import { Check, Ellipsis, Play, ScissorsLineDashed, X } from "lucide-react";
import { CaretDownIcon } from "@radix-ui/react-icons";
import { match } from "ts-pattern";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { selectAtom } from "jotai/utils";
import {
  ATOM_clearResults,
  ATOM_getEdgeChain,
  ATOM_preprocessChain,
  ATOM_resolvePod,
} from "@/lib/store/runtimeSlice";
import {
  ATOM_nodesMap,
  ATOM_resultChanged,
  ATOM_resultMap,
  ATOM_runtimeReady,
} from "@/lib/store/yjsSlice";
import { ATOM_cutId, ATOM_repoId } from "@/lib/store/atom";

import juliaLogo from "@/assets/julia.svg";
import pythonLogo from "@/assets/python.svg";
import javascriptLogo from "@/assets/javascript.svg";
import racketLogo from "@/assets/racket.svg";
import { toast } from "react-toastify";
import { env } from "@/lib/vars";
import { ATOM_parsePod } from "@/lib/store/runtimeSlice";
import { CodeNodeType, ScopeNodeType } from "@/lib/store/types";
import { ATOM_addScope } from "@/lib/store/canvasSlice";

function Timer({ lastExecutedAt }) {
  const [counter, setCounter] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setCounter(counter + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [counter]);
  return (
    <div> at {timeDifference(new Date(), new Date(lastExecutedAt))} ago</div>
  );
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

  const scrollDivRef = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);

  useEffect(() => {
    if (scrollDivRef.current && follow) {
      scrollDivRef.current.scrollTop = scrollDivRef.current.scrollHeight;
    }
  }, [result, follow]);

  const [expand, setExpand] = useState(false);

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
      <Flex
        gap="2"
        style={{
          backgroundColor: "var(--accent-3)",
          height: "var(--space-6)",
          alignItems: "center",
          padding: "0 10px",
        }}
      >
        <>
          {exec_count && (
            <Box
              style={{
                color: "var(--gray-9)",
                textAlign: "left",
              }}
            >
              [{exec_count}]
            </Box>
          )}
          {error && <X color="red" />}
          {!error && !running && <Check color="green" />}
          {lastExecutedAt && <Timer lastExecutedAt={lastExecutedAt} />}
          {running && <Spinner />}
          <Flex flexGrow="1" />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <IconButton variant="ghost" size="1">
                <CaretDownIcon />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item
                onSelect={() => {
                  setFollow(!follow);
                }}
              >
                {follow ? "Unfollow" : "Follow"}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => {
                  setExpand(!expand);
                }}
              >
                {expand ? "Collapse" : "Expand"}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => {
                  setResultScroll(!resultScroll);
                }}
                disabled
              >
                Focus
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => {
                  clearResults(id);
                }}
                color="red"
              >
                Clear
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </>
      </Flex>
      {/* result content */}
      <div
        // Force display vertical scrollbar. Styles defined in custom.css.
        className="result-content"
        style={{
          backgroundColor: "var(--accent-2)",
          ...(expand
            ? {}
            : {
                maxHeight: "200px",
                overflow: "scroll",
              }),

          fontSize: "0.8em",
          padding: "0 5px",
          whiteSpace: "pre-wrap",
        }}
        ref={scrollDivRef}
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

        {error && <Box style={{ color: "red" }}>{error?.evalue}</Box>}
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

function MyPodToolbar({ node }: { node: CodeNodeType }) {
  const id = node.id;
  const preprocessChain = useSetAtom(ATOM_preprocessChain);
  const getEdgeChain = useSetAtom(ATOM_getEdgeChain);

  const runChain = runtimeTrpc.k8s.runChain.useMutation();
  const lang = node.data.lang;
  const runtimeReady =
    lang &&
    useAtomValue(
      React.useMemo(() => selectAtom(ATOM_runtimeReady, (v) => v[lang]), [id])
    );
  const repoId = useAtomValue(ATOM_repoId)!;
  const parsePod = useSetAtom(ATOM_parsePod);
  const resolvePod = useSetAtom(ATOM_resolvePod);
  const addScope = useSetAtom(ATOM_addScope);

  return (
    <PodToolbar id={id}>
      {/* The run button */}
      <IconButton
        variant="ghost"
        radius="small"
        style={{
          margin: 3,
          padding: 0,
        }}
        disabled={!runtimeReady}
        onClick={() => {
          const specs = preprocessChain([id]);
          if (specs) runChain.mutate({ repoId, specs });
        }}
      >
        <Play />
      </IconButton>

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
          <DropdownMenu.Item
            shortcut="⇧ ⏎"
            onSelect={() => {
              const specs = preprocessChain([id]);
              if (specs) runChain.mutate({ repoId, specs });
            }}
            disabled={!runtimeReady}
          >
            Run
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={!runtimeReady}
            onSelect={() => {
              const chain = getEdgeChain(id);
              const specs = preprocessChain(chain);
              if (specs) runChain.mutate({ repoId, specs });
            }}
          >
            Run Chain
          </DropdownMenu.Item>

          <DropdownMenu.Item onSelect={() => parsePod(id)}>
            Parse
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => resolvePod(id)}>
            Resolve
          </DropdownMenu.Item>

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
function useRunKey({ node }: { node: CodeNodeType }) {
  // The runtime ATOMs and trpc APIs.
  const runChain = runtimeTrpc.k8s.runChain.useMutation();
  const preprocessChain = useSetAtom(ATOM_preprocessChain);
  const lang = node.data.lang;
  const runtimeReady =
    lang &&
    useAtom(
      React.useMemo(
        () => selectAtom(ATOM_runtimeReady, (v) => v[lang]),
        [node.id]
      )
    );
  const repoId = useAtomValue(ATOM_repoId)!;
  // call useHotKeys library
  return useHotkeys<HTMLDivElement>(
    "shift+enter",
    () => {
      if (!runtimeReady) {
        toast.error("Runtime is not ready.");
      } else {
        const specs = preprocessChain([node.id]);
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

export const CodeNode = memo<NodeProps>(function ({ id }) {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);
  if (!node) return null;
  if (node.type !== "CODE") {
    throw new Error("Should not reach here");
  }
  return <CodeNodeImpl node={node} />;
});

function CodeNodeImpl({ node }: { node: CodeNodeType }) {
  const id = node.id;
  let ref = useRunKey({ node });
  const cutId = useAtomValue(ATOM_cutId);
  const nodesMap = useAtomValue(ATOM_nodesMap);

  return (
    <div
      // className="nodrag"
      style={{
        width: "100%",
        minWidth: "300px",
        // This is the key to let the node auto-resize w.r.t. the content.
        height: "auto",
        // minHeight: "50px",
        backdropFilter: "blur(10px)",
        backgroundColor: "rgba(228, 228, 228, 0.5)",
        // backgroundImage: "linear-gradient(200deg, #FDEB82, #F78FAD)",
        // backgroundColor: "red",
        // backgroundImage: "linear-gradient(200deg, #41D8DD, #5583EE)",
        // backgroundImage: "linear-gradient(200deg, #FAF8F9, #F0EFF0)",
        // padding: "8px",
        borderRadius: "8px",
        // border: isCutting ? "3px dash" : "3px solid",
        // borderColor: focused ? "black" : "transparent",
        border: cutId === id ? "3px dashed red" : "3px solid transparent",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
      }}
      className="nodrag"
      ref={ref}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",

          // border: "solid 1px black",
          backgroundColor: "white",

          // NOTE: monaco editor has a overflow-guard that needs to have border
          // radius as well. See .overflow-guard and .monaco-editor in
          // custom.css.
          borderRadius: "4px",
        }}
      >
        {!env.READ_ONLY && <MyPodToolbar node={node} />}
        <div
          style={{
            paddingTop: "5px",
            cursor: "auto",
          }}
        >
          <MyMonaco node={node} />
        </div>
        <ResultBlock id={id} />
        <SymbolTable id={id} />

        {/* <HandleWithHover id={id} /> */}
        <Handle id="left" type="source" position={Position.Left} />
        <Handle id="right" type="source" position={Position.Right} />

        <Box
          style={{
            position: "fixed",
            bottom: 0,
            right: 0,
            transform: "translate(-50%, -50%)",
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

        <NodeResizeControl
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
          // FIXME couldn't get the variant to work.
          variant={"line" as any}
          // variant={ResizeControlVariant.Line}
          color="transparent"
          style={{
            border: "10px solid transparent",
            transform: "translateX(-30%)",
          }}
        />
      </div>
    </div>
  );
}
