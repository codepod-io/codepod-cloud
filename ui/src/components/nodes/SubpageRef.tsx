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
  ATOM_clearResults,
  ATOM_getEdgeChain,
  ATOM_preprocessChain,
  ATOM_resolvePod,
  getOrCreate_ATOM_publicST,
  getOrCreate_ATOM_selfST,
} from "@/lib/store/runtimeSlice";
import {
  ATOM_codeMap,
  ATOM_nodesMap,
  ATOM_resultMap,
  ATOM_subpageMap,
  getOrCreate_ATOM_resultChanged,
  getOrCreate_ATOM_runtimeReady,
} from "@/lib/store/yjsSlice";
import { ATOM_currentPage, ATOM_cutId, ATOM_repoData } from "@/lib/store/atom";

import { toast } from "react-toastify";
import { env } from "@/lib/vars";
import { ATOM_parsePod } from "@/lib/store/runtimeSlice";
import { AppNode, CodeNodeType, SubpageRefNodeType } from "@/lib/store/types";
import { motion } from "framer-motion";
import {
  ATOM_collisionIds,
  ATOM_escapedIds,
  ATOM_insertMode,
  ATOM_jumpToPod,
  ATOM_selectPod,
  ATOM_toggleIsInit,
  ATOM_togglePinPod,
  ATOM_togglePublic,
  ATOM_toggleTest,
  ATOM_updateView,
  getAbsPos,
} from "@/lib/store/canvasSlice";
import {
  ATOM_changeScope,
  ATOM_deletePod,
} from "@/lib/store/canvasSlice_addNode";
import { ChangeScopeItem } from "./Code";

// FIXME memo `node` may be problematic.
const MyPodToolbar = memo(function MyPodToolbar({
  node,
}: {
  node: SubpageRefNodeType;
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

const MyPodToolbarImpl = memo(function MyPodToolbarImpl({
  node,
}: {
  node: SubpageRefNodeType;
}) {
  const id = node.id;
  const preprocessChain = useSetAtom(ATOM_preprocessChain);
  const getEdgeChain = useSetAtom(ATOM_getEdgeChain);

  const runChain = runtimeTrpc.k8s.runChain.useMutation();
  const repoData = useAtomValue(ATOM_repoData);
  myassert(repoData);
  const repoId = repoData.id;
  const parsePod = useSetAtom(ATOM_parsePod);
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
          <DropdownMenu.Separator />
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

export const SubpageRefNode = memo(function ({ id }: NodeProps) {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);
  if (!node) return null;
  if (node.type !== "SubpageRef") {
    throw new Error("Should not reach here");
  }
  return <SubpageRefNodeImpl id={id} />;
});

/**
 * This is the handle that appears when the user is dragging a node to connect.
 */
export const MyHandle = memo(function MyHandle({
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
});

const SubpageRefNodeImpl = memo(function SubpageRefNodeImpl({
  id,
}: {
  id: string;
}) {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const subpageMap = useAtomValue(ATOM_subpageMap);
  const node = nodesMap.get(id);

  const cutId = useAtomValue(ATOM_cutId);
  const [hover, setHover] = useState(false);

  const insertMode = useAtomValue(ATOM_insertMode);

  const connection = useConnection();

  const isTarget = connection.inProgress && connection.fromNode.id !== id;
  // collisions
  const collisionIds = useAtomValue(ATOM_collisionIds);
  const escapedIds = useAtomValue(ATOM_escapedIds);

  const setCurrentPage = useSetAtom(ATOM_currentPage);
  const updateView = useSetAtom(ATOM_updateView);

  // NOTE: we have to check node here and return early (after all the hooks). On
  // deleting this node, collisionIds will cause this component to be
  // re-rendered. In that phase, the id does not exist in nodesMap.
  if (!node) return null;
  myassert(node.type === "SubpageRef");
  const subpage = subpageMap.get(node.data.refId);
  myassert(subpage);

  return (
    <div
      style={{
        width: node.data.mywidth,
        minWidth: "300px",
        // code mirror doesn't come with a default background color.
        backgroundColor: "lightblue",
        // this needs to be in sync with the radius below, otherwise the node is still rectangular.
        borderRadius: "8px",
      }}
    >
      {insertMode === "Move" && (
        <div
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
        </div>
      )}
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
            alignItems: "center",
          }}
        >
          <div
            style={{
              opacity: hover ? 1 : 0,
            }}
          >
            <MyPodToolbar node={node} />
          </div>
          Subpage
          <Text weight={"bold"}>{subpage.title}</Text>
          <Button
            onClick={() => {
              setCurrentPage(subpage.id);
              updateView();
            }}
          >
            Open
          </Button>
          <SubpageSymbols subpageId={subpage.id} />
          <MyNodeResizer />
          <MyHandle hover={hover} isTarget={isTarget} />
        </div>
      </div>
    </div>
  );
});

function SubpageSymbols({ subpageId }: { subpageId: string }) {
  const st = useAtomValue(getOrCreate_ATOM_publicST(subpageId));
  const jumpToPod = useSetAtom(ATOM_jumpToPod);
  return (
    <div>
      {[...st.keys()].slice(0, 20).map((key) => (
        <Flex align="center" key={key}>
          <Button
            onClick={() => {
              // jump to the node
              const target = st.get(key);
              myassert(target);
              jumpToPod(target.final);
            }}
            variant="ghost"
            style={{
              fontSize: "inherit",
              padding: "0.5em 1em",
              color: "green",
            }}
          >
            <code>{key}</code>
          </Button>
        </Flex>
      ))}
    </div>
  );
}

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
