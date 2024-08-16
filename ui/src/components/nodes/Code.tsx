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
  ResizeControlVariant,
} from "reactflow";

import { useHotkeys } from "react-hotkeys-hook";

import Ansi from "ansi-to-react";

import { MyMonaco } from "../MyMonaco";

import { Handles, PodToolbar, ToolbarAddPod } from "./utils";
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
import { ATOM_repoId } from "@/lib/store/atom";

import juliaLogo from "@/assets/julia.svg";
import pythonLogo from "@/assets/python.svg";
import javascriptLogo from "@/assets/javascript.svg";
import racketLogo from "@/assets/racket.svg";
import { toast } from "react-toastify";
import { env } from "@/lib/vars";

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
      </Flex>
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

function MyPodToolbar({ id }: { id: string }) {
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

  return (
    <PodToolbar>
      {/* Toolbar for adding new pod top/bottom/right */}
      <ToolbarAddPod id={id} position="top" />
      <ToolbarAddPod id={id} position="bottom" />
      <ToolbarAddPod id={id} position="right" />
      <IconButton
        variant="ghost"
        radius="full"
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
        <Play size="1.2em" />
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
          {/* <DropdownMenu.Item
            shortcut="⌘ ⌫"
            color="red"
            onClick={() => {
              // Delete all edges connected to the node.
              reactFlowInstance.deleteElements({ nodes: [{ id }] });
            }}
          >
            Delete
          </DropdownMenu.Item> */}

          {/* Delete with Confirmation. */}
          <ConfirmedDelete id={id} />
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </PodToolbar>
  );
}

// Ref: https://github.com/radix-ui/primitives/discussions/1830#discussioncomment-10300947
function ConfirmedDelete({ id }) {
  const ref = useRef<HTMLButtonElement>(null);
  const reactFlowInstance = useReactFlow();
  return (
    <Dialog.Root>
      {/* Try 1: This button is not the style of DropDown MenuItem. */}
      {/* <Button>Delete</Button> */}

      {/* <Button>Delete</Button> */}

      {/* Try 2: Trigger the inner event. Either stop propagation on inner, or preventDefault on outer.
          However, the outer is bigger than the inner. As a result, clicking on the shortcut part of the outer
          will not be picked up by the inner trigger. */}

      {/* <DropdownMenu.Item
        color="red"
        shortcut="⌘ ⌫"
        onClick={(e) => {
          e.preventDefault();
        }}
      >
        <div>
          <Dialog.Trigger
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div>Delete</div>
          </Dialog.Trigger>
        </div>
      </DropdownMenu.Item> */}

      {/* Try 3 (which works):  use a ref and trigger the click on the inner from the outer. */}
      <DropdownMenu.Item
        color="red"
        shortcut="⌘ ⌫"
        onClick={(e) => {
          e.preventDefault();
          ref?.current?.click();
        }}
      >
        <div>
          <Dialog.Trigger ref={ref}>
            <div></div>
          </Dialog.Trigger>
          Delete
        </div>
      </DropdownMenu.Item>

      <Dialog.Content maxWidth="450px">
        <Dialog.Title size="3">This will delete pod.</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          Continue?
        </Dialog.Description>

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              Cancel
            </Button>
          </Dialog.Close>
          <Dialog.Close>
            <DropdownMenu.Item
              color="red"
              onClick={() => {
                // Delete all edges connected to the node.
                reactFlowInstance.deleteElements({ nodes: [{ id }] });
              }}
            >
              Delete
            </DropdownMenu.Item>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
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
  // call useHotKeys library
  return useHotkeys<HTMLDivElement>(
    "shift+enter",
    () => {
      if (!runtimeReady) {
        toast.error("Runtime is not ready.");
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

export const CodeNode = memo<NodeProps>(function ({ id }) {
  const [nodesMap] = useAtom(ATOM_nodesMap);

  const [hover, setHover] = useState(false);

  const [focused, setFocused] = useState(false);

  let ref = useRunKey({ id })!;

  const node = nodesMap.get(id);
  if (!node) return null;

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
        border: "3px solid",
        borderColor: focused ? "black" : "transparent",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
      }}
      className="nodrag"
      ref={ref}
    >
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
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
        {!env.READ_ONLY && <MyPodToolbar id={id} />}
        <div
          style={{
            paddingTop: "5px",
            cursor: "auto",
          }}
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
        >
          <MyMonaco id={id} />
        </div>
        <ResultBlock id={id} />

        <HandleWithHover id={id} />

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
          variant={ResizeControlVariant.Line}
          color="transparent"
          style={{
            border: "10px solid transparent",
            transform: "translateX(-30%)",
          }}
        />
      </div>
    </div>
  );
});
