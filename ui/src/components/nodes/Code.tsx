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
  SymbolTable,
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
  Check,
  CornerDownLeft,
  CornerRightUp,
  Ellipsis,
  GripVertical,
  Play,
  ScissorsLineDashed,
  Trash2,
  X,
} from "lucide-react";
import { CaretDownIcon } from "@radix-ui/react-icons";
import { match } from "ts-pattern";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { selectAtom } from "jotai/utils";
import {
  ATOM_clearResults,
  ATOM_getEdgeChain,
  ATOM_preprocessChain,
  ATOM_resolvePod,
  getOrCreate_ATOM_selfST,
} from "@/lib/store/runtimeSlice";
import {
  ATOM_codeMap,
  ATOM_nodesMap,
  ATOM_resultChanged,
  ATOM_resultMap,
  ATOM_runtimeReady,
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
  ATOM_insertMode,
  getAbsPos,
} from "@/lib/store/canvasSlice";
import {
  ATOM_changeScope,
  ATOM_deletePod,
} from "@/lib/store/cavnasSlice_addNode";

function Timer({ lastExecutedAt }) {
  useTick(1000);
  return (
    <div> at {timeDifference(new Date(), new Date(lastExecutedAt))} ago</div>
  );
}

export const ResultBlock = memo(function ResultBlock({ id }: { id: string }) {
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
      Change Scope
    </DropdownMenu.Item>
  );
}

// FIXME memo `node` may be problematic.
const MyPodToolbar = memo(function MyPodToolbar({
  node,
}: {
  node: CodeNodeType;
}) {
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
  const repoData = useAtomValue(ATOM_repoData);
  myassert(repoData);
  const repoId = repoData.id;
  const parsePod = useSetAtom(ATOM_parsePod);
  const resolvePod = useSetAtom(ATOM_resolvePod);

  const deletePod = useSetAtom(ATOM_deletePod);

  return (
    <Flex
      align="center"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        // border: "solid 1px var(--gray-8)",
        transform: "translateY(-120%)",
        backgroundColor: "white",
        borderRadius: "5px",
        boxShadow: "0 0 10px rgba(0,0,0,0.2)",
        cursor: "auto",
      }}
    >
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
        <DropdownMenu.Content color="yellow">
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
    </Flex>
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

export const CodeNode = function ({ id }: NodeProps) {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);
  if (!node) return null;
  if (node.type !== "CODE") {
    throw new Error("Should not reach here");
  }
  return <CodeNodeImpl id={id} />;
};

/**
 * This is the handle that appears when the user is dragging a node to connect.
 */
export function MyHandle({
  hover,
  isTarget,
}: {
  hover: boolean;
  isTarget: boolean;
}) {
  const insertMode = useAtomValue(ATOM_insertMode);
  return (
    <Box
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        ...(insertMode === "Connect"
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
      <Text>
        {insertMode === "Connect" &&
          (isTarget ? "Drop Here" : "Drag to connect")}
      </Text>
    </Box>
  );
}

function CodeNodeImpl({ id }: { id: string }) {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);

  const cutId = useAtomValue(ATOM_cutId);
  const [hover, setHover] = useState(false);

  const insertMode = useAtomValue(ATOM_insertMode);

  const connection = useConnection();

  const isTarget = connection.inProgress && connection.fromNode.id !== id;
  // collisions
  const collisionIds = useAtomValue(ATOM_collisionIds);
  const escapedIds = useAtomValue(ATOM_escapedIds);

  // NOTE: we have to check node here and return early (after all the hooks). On
  // deleting this node, collisionIds will cause this component to be
  // re-rendered. In that phase, the id does not exist in nodesMap.
  if (!node) return null;
  myassert(node.type === "CODE");

  return (
    <div
      style={{
        width: node.data.mywidth,
        minWidth: "300px",
      }}
    >
      {insertMode === "Move" && (
        <Box
          className="custom-drag-handle"
          style={{
            // put it on top of Monaco
            zIndex: 10,
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
      <div
        // className="nodrag"
        style={{
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
          borderWidth: "5px",
          borderStyle: cutId === id ? "dashed" : "solid",
          borderColor:
            cutId === id
              ? "red"
              : escapedIds.includes(id)
                ? "orange"
                : collisionIds.includes(id)
                  ? "pink"
                  : "transparent",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <Flex direction="column">
          {!env.READ_ONLY && (
            <motion.div
              animate={{
                opacity: hover ? 1 : 0,
              }}
            >
              <MyPodToolbar node={node} />
            </motion.div>
          )}
          <Box
            style={{
              position: "relative",
            }}
          >
            <MyMonaco id={id} />
            <Box
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                transform: "translate(-5px, 0)",
              }}
            >
              {/* .py */}
              {match(node.data.lang)
                .with("python", () => <PythonLogo />)
                .with("julia", () => <JuliaLogo />)
                .with("javascript", () => <JavaScriptLogo />)
                .with("racket", () => <RacketLogo />)
                .otherwise(() => "??")}{" "}
            </Box>
          </Box>
          <ResultBlock id={id} />
          <SymbolTable id={id} />

          <MyHandle hover={hover} isTarget={isTarget} />

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
        </Flex>
      </div>
    </div>
  );
}
