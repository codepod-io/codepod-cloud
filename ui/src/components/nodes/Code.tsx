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
  useConnection,
  useStore,
} from "@xyflow/react";
import { ResizeControlVariant } from "@xyflow/react";

import Ansi from "ansi-to-react";

import { MyMonaco } from "../MyMonaco";

import {
  ConfirmedDelete,
  JavaScriptLogo,
  JuliaLogo,
  PythonLogo,
  RacketLogo,
} from "./utils";
import { myassert, timeDifference, useTick } from "@/lib/utils/utils";

import { runtimeTrpc, trpc } from "@/lib/trpc";
import {
  Box,
  Button,
  Dialog,
  DropdownMenu,
  Flex,
  IconButton,
  Spinner,
  Switch,
  Text,
} from "@radix-ui/themes";
import {
  Cable,
  Check,
  CornerDownLeft,
  CornerRightUp,
  Ellipsis,
  FlaskConical,
  FlaskConicalOff,
  GripVertical,
  Group,
  ListVideo,
  Pin,
  Play,
  ScissorsLineDashed,
  ShieldQuestion,
  Trash2,
  Variable,
  X,
} from "lucide-react";
import { CaretDownIcon } from "@radix-ui/react-icons";
import { TbApi, TbApiOff } from "react-icons/tb";
import { match } from "ts-pattern";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ATOM_clearParseResult,
  ATOM_clearResults,
  ATOM_getEdgeChain,
  ATOM_preprocessChain,
  ATOM_resolvePod,
  getOrCreate_ATOM_isParsing,
  getOrCreate_ATOM_selfST,
} from "@/lib/store/runtimeSlice";
import {
  ATOM_codeMap,
  ATOM_nodesMap,
  ATOM_resultMap,
  getOrCreate_ATOM_resultChanged,
  getOrCreate_ATOM_runtimeReady,
} from "@/lib/store/yjsSlice";
import { ATOM_cutId, ATOM_repoData } from "@/lib/store/atom";

import { toast } from "react-toastify";
import { env } from "@/lib/vars";
import { ATOM_parsePod } from "@/lib/store/runtimeSlice";
import { AppNode, CodeNodeType } from "@/lib/store/types";
import { motion } from "framer-motion";
import {
  ATOM_collisionIds,
  ATOM_escapedIds,
  ATOM_toggleIsInit,
  ATOM_togglePinPod,
  ATOM_togglePublic,
  ATOM_toggleTest,
  getAbsPos,
} from "@/lib/store/canvasSlice";
import {
  ATOM_changeScope,
  ATOM_deletePod,
} from "@/lib/store/canvasSlice_addNode";
import { MyCodeMirror } from "../MyCodeMirror";

function Timer({ lastExecutedAt }) {
  useTick(1000);
  return (
    <div> at {timeDifference(new Date(), new Date(lastExecutedAt))} ago</div>
  );
}

export const ResultBlock = memo(function ResultBlock({ id }: { id: string }) {
  const [resultScroll, setResultScroll] = useState(false);

  const clearResults = useSetAtom(ATOM_clearResults);
  // Monitor result change.
  // Do not remove this. This variable is not used but it is necessary to trigger re-render.
  const resultChanged = useAtomValue(getOrCreate_ATOM_resultChanged(id));

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
                  // No newline if the result text doesn't contain new line.
                  // <code key={combinedKey} style={{}}>
                  //   {res.text}
                  // </code>
                  //
                  // UPDATE: the above is to fix the datum->syntax debugging in
                  // racket. The "extra newline" issue doesn't seem to present
                  // in regular cases. So we revert back to the original.
                  //
                  // This Ansi is needed to e.g., show the color in the pip install output.
                  <Ansi key={combinedKey}>{res.text}</Ansi>
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
                      //
                      // res.text
                      //
                      // deno kernel outputs Ansi text.
                      <Ansi>{res.text}</Ansi>
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

export function ChangeScopeItem({ id }: { id: string }) {
  const { getIntersectingNodes } = useReactFlow<AppNode>();
  const changeScope = useSetAtom(ATOM_changeScope);
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);
  myassert(node);

  return (
    <DropdownMenu.Item
      onSelect={() => {
        // change the current pod to be of the scope at its current position
        // 1. get the scope at this position
        // get scope at the position
        const absPos = getAbsPos(node, nodesMap);
        const scopes = getIntersectingNodes({
          x: absPos.x,
          y: absPos.y,
          width: 1,
          height: 1,
        })
          .filter((node) => node.type === "SCOPE")
          // this item might be a scope. We don't move a scope into itself.
          .filter((node) => node.id !== id)
          .sort(
            (a: AppNode, b: AppNode) =>
              (b.data.level ?? 0) - (a.data.level ?? 0)
          );
        // 2. change the scope of the pod
        if (scopes.length > 0) {
          changeScope({ id: node.id, scopeId: scopes[0].id });
        } else {
          changeScope({ id: node.id, scopeId: undefined });
        }
      }}
    >
      <Group /> Change Scope
    </DropdownMenu.Item>
  );
}

// FIXME memo `node` may be problematic.
const MyPodToolbar = memo(function MyPodToolbar({
  node,
}: {
  node: CodeNodeType;
}) {
  // This will not trigger change.
  // const { getZoom } = useReactFlow();
  // const zoom = getZoom();
  // console.log("zoom", zoom);

  // This will trigger change when zooming.
  const zoom = useStore((s) => Math.max(s.transform[2], 0.3));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        position: "absolute",
        top: 0,
        right: 0,
        padding: "4px",
        // border: "solid 1px var(--gray-8)",
        transform: `translate(0%, -100%) scale(${1 / zoom})`,
        transformOrigin: "bottom right",
        backgroundColor: "white",
        borderRadius: "5px",
        boxShadow: "0 0 10px rgba(0,0,0,0.2)",
        cursor: "auto",
      }}
    >
      <MyPodToolbarImpl node={node} />
    </div>
  );
});

/**
 * The edge connect handler.
 */
export function HandleOnToolbar() {
  return (
    <Box
      style={{
        position: "relative",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        opacity: 1,
      }}
    >
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        style={{
          width: "100%",
          height: "100%",

          minWidth: 0,
          minHeight: 0,
          // position: "absolute",
          // background: "blue",
          border: "none",
          opacity: 0,
          borderRadius: 0,
          transform: "none",
          top: 0,
          left: 0,
          fontWeight: "bold",
          backgroundColor: "blue",
        }}
        // So that click on one handle then click on another handle will not trigger the edge creation.
        isConnectableEnd={false}
      />
      <Cable />
    </Box>
  );
}

const MyPodToolbarImpl = memo(function MyPodToolbarImpl({
  node,
}: {
  node: CodeNodeType;
}) {
  const id = node.id;
  const preprocessChain = useSetAtom(ATOM_preprocessChain);
  const getEdgeChain = useSetAtom(ATOM_getEdgeChain);

  const runChain = runtimeTrpc.k8s.runChain.useMutation();
  const lang = node.data.lang;
  const runtimeReady = useAtomValue(getOrCreate_ATOM_runtimeReady(lang));
  const repoData = useAtomValue(ATOM_repoData);
  myassert(repoData);
  const repoId = repoData.id;
  const parsePod = useSetAtom(ATOM_parsePod);
  const clearParseResult = useSetAtom(ATOM_clearParseResult);
  const resolvePod = useSetAtom(ATOM_resolvePod);

  const deletePod = useSetAtom(ATOM_deletePod);
  const toggleTest = useSetAtom(ATOM_toggleTest);
  const togglePublic = useSetAtom(ATOM_togglePublic);
  const togglePinPod = useSetAtom(ATOM_togglePinPod);
  const toggleIsInit = useSetAtom(ATOM_toggleIsInit);

  return (
    <>
      {/* drag handle */}
      <Box
        className="custom-drag-handle"
        style={{
          cursor: "grab",
          display: "inline-flex",
        }}
      >
        <GripVertical />
      </Box>
      {/* The run button */}
      <IconButton
        variant="ghost"
        radius="small"
        style={{
          margin: 3,
          padding: 0,
        }}
        disabled={!runtimeReady}
        onClick={async () => {
          const specs = await preprocessChain([id]);
          if (specs.length > 0) runChain.mutate({ repoId, specs });
        }}
      >
        <Play />
      </IconButton>

      <HandleOnToolbar />

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
          <DropdownMenu.Item
            shortcut="⇧ ⏎"
            onSelect={async () => {
              const specs = await preprocessChain([id]);
              if (specs.length > 0) runChain.mutate({ repoId, specs });
            }}
            disabled={!runtimeReady}
          >
            <Play /> Run
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={!runtimeReady}
            onSelect={async () => {
              const chain = getEdgeChain(id);
              const specs = await preprocessChain(chain);
              if (specs.length > 0) runChain.mutate({ repoId, specs });
            }}
          >
            <ListVideo /> Run Chain
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={async () => {
              clearParseResult(id);
              await parsePod(id);
            }}
          >
            <Variable /> Parse
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => resolvePod(id)}>
            <ShieldQuestion />
            Resolve
          </DropdownMenu.Item>
          {/* separator */}
          <DropdownMenu.Separator />
          {/* toggle init */}
          <DropdownMenu.Item
            onSelect={() => {
              toggleIsInit(id);
            }}
          >
            <div
              style={{
                borderRadius: "50%",
                width: "1em",
                height: "1em",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid black",
              }}
            >
              1
            </div>
            Toggle Init
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => {
              toggleTest(id);
            }}
          >
            {node.data.isTest ? (
              <>
                <FlaskConicalOff />
                Toggle Test
              </>
            ) : (
              <>
                <FlaskConical /> Toggle Test
              </>
            )}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => {
              togglePublic(id);
            }}
          >
            {node.data.isPublic ? (
              <>
                <TbApiOff />
                Toggle Public
              </>
            ) : (
              <>
                <TbApi /> Toggle Public
              </>
            )}
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={() => {
              togglePinPod(id);
            }}
          >
            <Pin /> Toggle Pin
          </DropdownMenu.Item>

          <DropdownMenu.Separator />
          {/* assign group */}
          <ChangeScopeItem id={id} />
          <DropdownMenu.Separator />
          <ConfirmedDelete
            color="red"
            onSelect={() => {
              deletePod(id);
            }}
            trigger={
              <>
                <Trash2 /> Delete Pod
              </>
            }
            title="This will delete the pod."
            description="Continue?"
            confirm="Delete"
          />
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </>
  );
});

function FoldedCodeText({ id }) {
  const codeMap = useAtomValue(ATOM_codeMap);
  const ytext = codeMap.get(id);
  if (!ytext) return <>Empty</>;
  const code = ytext.toString();
  const firstLine = code.split("\n")[0];
  if (firstLine.length === 0) {
    return (
      <Text
        style={{
          opacity: 0,
        }}
      >
        Empty
      </Text>
    );
  }
  return <>{firstLine.substring(0, 20)} ..</>;
}

function FoldedCode({ id }: { id: string }) {
  // update: instead of showing the text, show the symbol tables if exist
  const selfSt = useAtomValue(getOrCreate_ATOM_selfST(id));
  if (selfSt.size > 0) {
    return (
      <Flex direction="column">
        {[...selfSt.keys()].map((key) => (
          <Flex align="center" key={key}>
            <code
              style={{
                fontSize: "2.5em",
                color: "black",
                // lineHeight: "var(--line-height-1)",
                // lineHeight: "10px",
                // do not wrap
                whiteSpace: "nowrap",
              }}
            >
              {key}
            </code>
          </Flex>
        ))}
      </Flex>
    );
  }
  return <FoldedCodeText id={id} />;
}

export const CodeNode = memo(function ({ id }: NodeProps) {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);
  if (!node) return null;
  if (node.type !== "CODE") {
    throw new Error("Should not reach here");
  }
  return <CodeNodeImpl id={id} />;
});

/**
 * This is the handle that appears when the user is dragging a node to connect.
 */
export const MyHandle = memo(function MyHandle({
  isTarget,
}: {
  isTarget: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <Box
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        ...(isTarget
          ? {
              width: "100%",
              height: "100%",
              backgroundColor: isTarget && hover ? "orange" : "transparent",
            }
          : { width: 0, height: 0 }),
        // make content horizontally and vertically centered
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        opacity: 0.5,
        // put it above Monaco
        zIndex: 999,
      }}
    >
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        style={{
          width: "100%",
          height: "100%",
          minWidth: 0,
          minHeight: 0,
          position: "absolute",
          // background: "blue",
          border: "none",
          opacity: 0,
          borderRadius: 0,
          transform: "none",
          top: 0,
          left: 0,
          fontWeight: "bold",
        }}
      />
      {isTarget && <Text>"Drop Here"</Text>}
    </Box>
  );
});

const CodeNodeImpl = memo(function CodeNodeImpl({ id }: { id: string }) {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);

  const cutId = useAtomValue(ATOM_cutId);
  const [hover, setHover] = useState(false);

  const connection = useConnection();

  const isTarget = connection.inProgress && connection.fromNode.id !== id;
  const isSource = connection.inProgress && connection.fromNode.id === id;

  // collisions
  const collisionIds = useAtomValue(ATOM_collisionIds);
  const escapedIds = useAtomValue(ATOM_escapedIds);

  // NOTE: we have to check node here and return early (after all the hooks). On
  // deleting this node, collisionIds will cause this component to be
  // re-rendered. In that phase, the id does not exist in nodesMap.
  if (!node) return null;
  myassert(node.type === "CODE");

  // For performance debugging.
  if (false as any) {
    return (
      <div
        style={{
          width: node.data.mywidth,
          minWidth: "300px",
          height: "100px",
          backgroundColor: "pink",
        }}
      >
        Test
        <MyHandle isTarget={isTarget} />
      </div>
    );
  }

  return (
    <div
      style={{
        width: node.data.mywidth,
        minWidth: "300px",
        // code mirror doesn't come with a default background color.
        backgroundColor: "white",
        // this needs to be in sync with the radius below, otherwise the node is still rectangular.
        borderRadius: "8px",
      }}
    >
      <div
        // className="nodrag"
        style={{
          // This is the key to let the node auto-resize w.r.t. the content.
          height: "auto",
          // minHeight: "50px",
          // backdropFilter: "blur(10px)",
          // backgroundColor: "rgba(228, 228, 228, 0.5)",
          // backgroundImage: "linear-gradient(200deg, #FDEB82, #F78FAD)",
          // backgroundColor: "red",
          // backgroundImage: "linear-gradient(200deg, #41D8DD, #5583EE)",
          // backgroundImage: "linear-gradient(200deg, #FAF8F9, #F0EFF0)",
          // padding: "8px",
          borderRadius: "8px",
          // border: isCutting ? "3px dash" : "3px solid",
          // borderColor: focused ? "black" : "transparent",
          borderWidth: "5px",
          borderStyle: cutId === id ? "dashed" : "solid",
          borderColor:
            cutId === id
              ? "red"
              : escapedIds.includes(id)
                ? "orange"
                : collisionIds.includes(id)
                  ? "pink"
                  : "var(--gray-2)",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Tags id={id} />
          {!env.READ_ONLY && (
            // <motion.div
            //   animate={{
            //     opacity: hover ? 1 : 0,
            //   }}
            // >
            //   <MyPodToolbar node={node} />
            // </motion.div>
            <div
              style={{
                opacity: isSource || hover ? 1 : 0,
              }}
            >
              <MyPodToolbar node={node} />
            </div>
          )}
          <div
            style={{
              position: "relative",
            }}
          >
            <MyMonaco id={id} />
            {/* <MyCodeMirror id={id} /> */}
            <Language lang={node.data.lang} />
          </div>
          <ResultBlock id={id} />
          <MyNodeResizer />
          <MyHandle isTarget={isTarget} />
        </div>
      </div>
    </div>
  );
});

const Tags = function Tags({ id }: { id: string }) {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);
  const selfSt = useAtomValue(getOrCreate_ATOM_selfST(id));
  const isParsing = useAtomValue(getOrCreate_ATOM_isParsing(id));
  const reactFlowInstance = useReactFlow();
  if (!node) throw new Error(`Node ${id} not found.`);
  return (
    <>
      {/* TOP: show self symbol table at the top, big font */}
      <Flex
        style={{
          // place it on the right
          position: "absolute",
          top: 0,
          left: 0,
          transform: "translateY(-100%) translateY(-10px)",
          pointerEvents: "none",
        }}
        direction={"column"}
        gap="4"
        wrap="wrap"
      >
        {/* tags */}
        {node.data.isTest && (
          <div
            style={{
              fontSize: "1.5em",
              whiteSpace: "nowrap",
            }}
          >
            <Text
              style={{
                color: "black",
                backgroundColor: "yellow",
                borderRadius: "5px",
                padding: "2px 5px",
              }}
            >
              test
            </Text>
          </div>
        )}
        {node.data.isInit && (
          <div
            style={{
              fontSize: "1.5em",
              whiteSpace: "nowrap",
            }}
          >
            <Text
              style={{
                color: "black",
                backgroundColor: "lightpink",
                borderRadius: "5px",
                padding: "2px 5px",
              }}
            >
              init
            </Text>
          </div>
        )}
        {node.data.isPublic && (
          <div
            style={{
              fontSize: "1.5em",
              whiteSpace: "nowrap",
            }}
          >
            <Text
              style={{
                color: "black",
                backgroundColor: "lightgreen",
                borderRadius: "5px",
                padding: "2px 5px",
              }}
            >
              public
            </Text>
          </div>
        )}
        {[...selfSt.keys()].map((key) => (
          <Flex align="center" key={key}>
            <code
              style={{
                fontSize: "4em",
                color: isParsing ? "gray" : "black",
                // lineHeight: "var(--line-height-1)",
                // lineHeight: "10px",
                lineHeight: "0.7em",
                // do not wrap
                whiteSpace: "nowrap",
              }}
            >
              {key}
            </code>
          </Flex>
        ))}
      </Flex>
    </>
  );
};

export const Language = memo(function Language({ lang }: { lang: string }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        right: 0,
        transform: "translate(-5px, 0)",
      }}
    >
      {match(lang)
        .with("python", () => <PythonLogo />)
        .with("julia", () => <JuliaLogo />)
        .with("javascript", () => <JavaScriptLogo />)
        .with("racket", () => <RacketLogo />)
        .otherwise(() => "??")}{" "}
    </div>
  );
});

function MyNodeResizer() {
  return (
    <NodeResizeControl
      minWidth={300}
      minHeight={50}
      // this allows the resize happens in X-axis only.
      position="right"
      // FIXME couldn't get the variant to work.
      variant={"line" as any}
      // variant={ResizeControlVariant.Line}
      color="transparent"
      style={{
        border: "10px solid transparent",
        transform: "translateX(-30%)",
      }}
    />
  );
}
