import { useEffect, useContext, useState } from "react";
import { useParams } from "react-router-dom";

import {
  Text,
  Tabs,
  Tooltip as RadixTooltip,
  Separator,
  Heading,
  Flex,
  IconButton,
  Card,
  Box,
  Tooltip,
  Button,
  Checkbox,
} from "@radix-ui/themes";

import { gray, mauve, violet } from "@radix-ui/colors";
import { AnimatePresence, motion } from "framer-motion";

import {
  Files,
  Search,
  ListTree,
  Cpu,
  Settings,
  Power,
  Play,
  RefreshCcw,
  CircleStop,
  ChevronRight,
  ChevronDown,
  NotebookPen,
} from "lucide-react";

import { sortNodes, downloadLink, repo2ipynb } from "./nodes/utils";

import * as Y from "yjs";

import { prettyPrintBytes, timeDifference } from "@/lib/utils/utils";
import { toSvg } from "html-to-image";
import { match } from "ts-pattern";

import { runtimeTrpc, trpc } from "@/lib/trpc";
import {
  ATOM_copilotManualMode,
  ATOM_scopedVars,
  ATOM_showAnnotations,
  ATOM_showLineNumbers,
} from "@/lib/store/settingSlice";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ATOM_centerSelection,
  ATOM_nodes,
  ATOM_selectedPods,
  ATOM_selectPod,
  ATOM_toggleFold,
} from "@/lib/store/canvasSlice";
import {
  ATOM_codeMap,
  ATOM_nodesMap,
  ATOM_resultMap,
  ATOM_runtimeChanged,
  ATOM_runtimeMap,
  ATOM_ydoc,
  ATOM_yjsStatus,
  ATOM_yjsSyncStatus,
} from "@/lib/store/yjsSlice";
import { ATOM_repoId, ATOM_repoName } from "@/lib/store/atom";
import { FpsMeter } from "@/lib/FpsMeter";

import juliaLogo from "@/assets/julia.svg";
import pythonLogo from "@/assets/python.svg";
import javascriptLogo from "@/assets/javascript.svg";
import racketLogo from "@/assets/racket.svg";

function SidebarSettings() {
  const [scopedVars, setScopedVars] = useAtom(ATOM_scopedVars);
  const [showAnnotations, setShowAnnotations] = useAtom(ATOM_showAnnotations);
  const [showLineNumbers, setShowLineNumbers] = useAtom(ATOM_showLineNumbers);
  const [copilotManualMode, setCopilotManualMode] = useAtom(
    ATOM_copilotManualMode
  );

  return (
    <Box>
      <Flex direction={"column"} gap="2">
        <Tooltip side="right" content={"Show Line Numbers"}>
          <Flex gap="3" align="center">
            <Checkbox
              size="3"
              checked={showLineNumbers}
              onClick={(e) => {
                setShowLineNumbers(!showLineNumbers);
              }}
            />
            <Text size="3">Line Numbers</Text>
          </Flex>
        </Tooltip>
        <Tooltip side="right" content={"Enable Scoped Variables"}>
          <Flex gap="3" align="center">
            <Checkbox
              size="3"
              checked={scopedVars}
              onClick={(e) => {
                setScopedVars(!scopedVars);
              }}
            />
            <Text size="3">Scoped Variables</Text>
          </Flex>
        </Tooltip>
        <Tooltip side="right" content={"Show Annotations in Editor"}>
          <Flex gap="3" align="center">
            <Checkbox
              size="3"
              checked={showAnnotations}
              onClick={(e) => {
                setShowAnnotations(!showAnnotations);
              }}
            />
            <Text size="3">Show Annotations</Text>
          </Flex>
        </Tooltip>
        <Tooltip
          side="right"
          content={"Ctrl+Shift+Space to trigger Copilot manually"}
        >
          <Flex gap="3" align="center">
            <Checkbox
              size="3"
              checked={copilotManualMode}
              onClick={(e) => {
                setCopilotManualMode(!copilotManualMode);
              }}
            />
            <Text size="3">Trigger Copilot Manually</Text>
          </Flex>
        </Tooltip>
        {showAnnotations && (
          <Flex direction={"column"} gap={"1"}>
            <Box className="myDecoration-function">Function Definition</Box>
            <Box className="myDecoration-vardef">Variable Definition</Box>
            <Box className="myDecoration-varuse">Function/Variable Use</Box>
            <Box className="myDecoration-varuse my-underline">
              Undefined Variable
            </Box>
          </Flex>
        )}
      </Flex>
    </Box>
  );
}

function KernelStatus({
  kernelName,
}: {
  kernelName: "julia" | "python" | "javascript" | "racket";
}) {
  const [repoId] = useAtom(ATOM_repoId);
  if (!repoId) throw new Error("repoId is null");
  // Observe runtime change
  useAtom(ATOM_runtimeChanged);
  // the status
  const [runtimeMap] = useAtom(ATOM_runtimeMap);
  // FIXME there're too many keys in runtimeMap, old keys should be removed.
  // console.log("runtimeMap", runtimeMap);
  // runtimeMap.forEach((value, key) => {
  //   console.log("key", key);
  //   console.log("value", value);
  // });
  const runtime = runtimeMap.get(kernelName);
  const status = runtimeTrpc.k8s.status.useMutation();
  const interrupt = runtimeTrpc.k8s.interrupt.useMutation();
  const start = runtimeTrpc.k8s.start.useMutation();
  const stop = runtimeTrpc.k8s.stop.useMutation();

  return (
    <Card>
      <Flex direction={"column"}>
        <Flex>
          {kernelName}:{" "}
          {match(runtime?.status)
            .with("idle", () => (
              <Box
                as="span"
                style={{
                  color: "green",
                }}
              >
                idle
              </Box>
            ))
            .with("busy", () => (
              <Box
                as="span"
                style={{
                  color: "var(--orange-9)",
                }}
              >
                busy
              </Box>
            ))
            .with(undefined, () => (
              <Box as="span" style={{ color: "red" }}>
                Off
              </Box>
            ))
            // FIXME the long text will stretch to the second line.
            .otherwise(() => runtime?.status)}{" "}
          {/* a dummy box to align the next item to the end */}
          <Box flexGrow={"1"} />
          {runtime === undefined ? (
            <IconButton
              onClick={() => {
                start.mutate({ repoId, kernelName });
              }}
              color="green"
              size="1"
              variant="ghost"
            >
              <Play />
            </IconButton>
          ) : (
            <IconButton
              onClick={() => {
                stop.mutate({ repoId, kernelName });
              }}
              color="red"
              size="1"
              variant="ghost"
            >
              <Power />
            </IconButton>
          )}
        </Flex>
        {runtime && (
          <Flex gap="1">
            <RadixTooltip content="Refresh Status">
              <IconButton
                onClick={() => {
                  status.mutate({ repoId, kernelName });
                }}
                size="1"
                variant="ghost"
              >
                <RefreshCcw />
              </IconButton>
            </RadixTooltip>

            <RadixTooltip content="Interrupt Kernel">
              <IconButton
                onClick={() => {
                  interrupt.mutate({ repoId, kernelName });
                }}
                size="1"
                variant="ghost"
                color="red"
              >
                <CircleStop />
              </IconButton>
            </RadixTooltip>
          </Flex>
        )}
        {/* createdAt */}
        <Flex>
          {runtime && (
            <CreatedAt
              createdAt={runtime.createdAt}
              recycledAt={runtime.recycledAt}
            />
          )}
        </Flex>
      </Flex>
    </Card>
  );
}

function CreatedAt({
  createdAt,
  recycledAt,
}: {
  createdAt?: number;
  recycledAt?: number;
}) {
  // refresh every second
  const [b, setB] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      setB((prev) => !prev);
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <Flex wrap="wrap">
      {createdAt && (
        <Box>{timeDifference(new Date(), new Date(createdAt))} ago</Box>
      )}
      {recycledAt && (
        <Box>{timeDifference(new Date(recycledAt), new Date())} remaining</Box>
      )}
    </Flex>
  );
}

const Runtime = () => {
  const [repoId] = useAtom(ATOM_repoId);
  if (!repoId) throw new Error("repoId is null");

  return (
    <Flex direction={"column"} gap="2">
      <Heading size="2">runtime</Heading>

      <KernelStatus kernelName="python" />
      <KernelStatus kernelName="julia" />
      <KernelStatus kernelName="javascript" />
      <KernelStatus kernelName="racket" />
    </Flex>
  );
};

function YjsSyncStatus() {
  // FIXME performance issue
  const [yjsStatus] = useAtom(ATOM_yjsStatus);
  const [yjsSyncStatus] = useAtom(ATOM_yjsSyncStatus);
  return (
    <Box>
      <Flex
        direction="row"
        gap={"2"}
        style={{
          alignItems: "center",
        }}
      >
        {/* Synced? <Box>{provider?.synced}</Box> */}
        {/* {yjsStatus} */}
        Sync Server:
        {match(yjsStatus)
          .with("connected", () => (
            <Box style={{ color: "green" }}>connected</Box>
          ))
          .with("disconnected", () => (
            <Box style={{ color: "red" }}>disconnected</Box>
          ))
          .with("connecting", () => (
            <Box style={{ color: "yellow" }}>connecting</Box>
          ))
          // .with("syncing", () => <Box color="green">online</Box>)
          .otherwise(() => `${yjsStatus}`)}
      </Flex>
      <Flex direction="row" gap={"2"}>
        Sync Status:
        {match(yjsSyncStatus)
          .with("uploading", () => (
            <Box style={{ color: "yellow" }}>uploading</Box>
          ))
          .with("synced", () => <Box style={{ color: "green" }}>synced</Box>)
          .otherwise(() => `Unknown: ${yjsSyncStatus}`)}
      </Flex>
    </Box>
  );
}

function ExportJupyterNB() {
  const { id: repoId } = useParams();
  const [repoName] = useAtom(ATOM_repoName);
  const [nodesMap] = useAtom(ATOM_nodesMap);
  const [resultMap] = useAtom(ATOM_resultMap);
  const [codeMap] = useAtom(ATOM_codeMap);
  const [loading, setLoading] = useState(false);

  const onClick = () => {
    setLoading(true);
    const fileContent = repo2ipynb(
      nodesMap,
      codeMap,
      resultMap,
      repoId,
      repoName
    );
    const dataUrl =
      "data:text/plain;charset=utf-8," + encodeURIComponent(fileContent);
    const filename = `${
      repoName || "Untitled"
    }-${new Date().toISOString()}.ipynb`;
    // Generate the download link on the fly
    downloadLink(dataUrl, filename);
    setLoading(false);
  };

  return (
    <Button variant="outline" size="1" onClick={onClick} disabled={loading}>
      Jupyter Notebook
    </Button>
  );
}

function ExportSVG() {
  // The name should contain the name of the repo, the ID of the repo, and the current date
  const { id: repoId } = useParams();
  const [repoName] = useAtom(ATOM_repoName);
  const filename = `${repoName?.replaceAll(
    " ",
    "-"
  )}-${repoId}-${new Date().toISOString()}.svg`;
  const [loading, setLoading] = useState(false);

  const onClick = () => {
    setLoading(true);
    const elem = document.querySelector(".react-flow");
    if (!elem) return;
    toSvg(elem as HTMLElement, {
      filter: (node) => {
        // we don't want to add the minimap and the controls to the image
        if (
          node?.classList?.contains("react-flow__minimap") ||
          node?.classList?.contains("react-flow__controls")
        ) {
          return false;
        }

        return true;
      },
    }).then((dataUrl) => {
      downloadLink(dataUrl, filename);
      setLoading(false);
    });
  };

  return (
    <Button variant="outline" size="1" onClick={onClick} disabled={loading}>
      Download Image
    </Button>
  );
}

function ExportButtons() {
  return (
    <Flex gap={"1"} direction={"column"}>
      <ExportJupyterNB />
      <ExportSVG />
    </Flex>
  );
}

function PodTreeItem({ id }) {
  const [nodesMap] = useAtom(ATOM_nodesMap);
  const node = nodesMap.get(id);
  if (!node) return null;

  const selectPod = useSetAtom(ATOM_selectPod);
  const setSelectedPods = useSetAtom(ATOM_selectedPods);
  const setCenterSelection = useSetAtom(ATOM_centerSelection);
  const toggleFold = useSetAtom(ATOM_toggleFold);
  return (
    <Flex direction="column">
      <Flex align="center" gap="2">
        {/* Node type icon */}
        <Box>
          {match(node.type)
            .with("CODE", () =>
              match(node.data.lang)
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
                .otherwise(() => <Box>???</Box>)
            )
            .with("RICH", () => <NotebookPen size={15} />)
            .otherwise(() => (
              <Box>???</Box>
            ))}
        </Box>

        {/* Node name */}
        <Button
          variant="ghost"
          onClick={() => {
            setSelectedPods(new Set<string>());
            selectPod({ id, selected: true });
            setCenterSelection(true);
          }}
        >
          {id.substring(0, 5)}
        </Button>

        {/* fold button */}
        {node.data.children?.length ? (
          <Button
            variant="ghost"
            size="1"
            style={{
              padding: 0,
            }}
          >
            {node.data.folded ? (
              <ChevronRight
                onClick={() => {
                  toggleFold(id);
                }}
              />
            ) : (
              <ChevronDown
                onClick={() => {
                  toggleFold(id);
                }}
              />
            )}
          </Button>
        ) : null}
      </Flex>

      {!node.data.folded && (
        <Flex>
          <Flex direction="column" style={{ paddingLeft: "15px" }}>
            {node.data.children?.map((child) => (
              <PodTreeItem key={child} id={child} />
            ))}
          </Flex>
        </Flex>
      )}
    </Flex>
  );
}

function TableofPods() {
  // listen to nodes change.
  const [nodes] = useAtom(ATOM_nodes);

  return (
    <Box>
      <PodTreeItem key={"ROOT"} id={"ROOT"} />
    </Box>
  );
}

const MyTabsRoot = ({
  tabs,
  side,
  children,
}: {
  tabs: { key: string; icon: any; content: any }[];
  side: "left" | "right";
  children: any;
}) => {
  const [value, setValue] = useState(tabs[0].key);
  const [open, setOpen] = useState(true);
  return (
    <Tabs.Root
      defaultValue={tabs[0].key}
      orientation="vertical"
      className="flex"
      value={value}
      style={{
        flexDirection: "row",
        // The sidebar tabs should be scrollable.
        overflow: "scroll",
      }}
    >
      {open && side === "right" && children}
      <Tabs.List
        style={{
          flexDirection: "column",
          backgroundColor: "#eee",
          border: "1px solid black",
          alignItems: "flex-start",
          zIndex: 2,
        }}
      >
        {tabs.map(({ key, icon }) => (
          <Tabs.Trigger
            key={key}
            value={key}
            className="justify-start"
            style={{
              ...(key === value ? { color: "red" } : {}),
            }}
            onClick={(event) => {
              event.preventDefault();
              if (value === key) {
                setOpen(!open);
                // setValue("");
              } else {
                setOpen(true);
                setValue(key);
              }
            }}
          >
            <RadixTooltip content={key} delayDuration={100} side="right">
              {icon}
            </RadixTooltip>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {open && side === "left" && children}
    </Tabs.Root>
  );
};

function MyTabs({
  tabs,
  side = "left",
}: {
  tabs: { key: string; icon: any; content: any }[];
  side: "left" | "right";
}) {
  return (
    <MyTabsRoot tabs={tabs} side={side}>
      <Box
        className="px-4 pt-3 pb-2"
        style={{
          border: "1px solid black",
          width: "200px",
          backgroundColor: gray.gray1,
          // The sidebar panel should be scrollable.
          overflow: "scroll",
        }}
      >
        <>
          {tabs.map(({ key, content }) => (
            <Tabs.Content key={key} value={key}>
              <Text size="2">{content}</Text>
            </Tabs.Content>
          ))}
        </>
      </Box>
    </MyTabsRoot>
  );
}

export function SidebarLeft() {
  return (
    <MyTabs
      side="left"
      tabs={[
        {
          key: "Files",
          icon: <Files />,
          // content: "Make changes to your account.".repeat(10),
          content: (
            <Flex direction="column">
              <YjsSyncStatus />
              <Heading size="2">Export to ..</Heading>
              <ExportButtons />
              <Separator my="3" size="4" />
              <Runtime />
              <Separator my="3" size="4" />
              <Heading mb="2" size="2">
                Experimental
              </Heading>
              <Heading mb="2" size="2">
                Performance
              </Heading>
              <FpsMeter />
            </Flex>
          ),
        },
        { key: "Search", icon: <Search />, content: "Search".repeat(10) },
        {
          key: "Outline",
          icon: <ListTree />,
          content: (
            <>
              <Heading size="2">Table of Pods</Heading>
              <TableofPods />
            </>
          ),
        },
        {
          key: "Runtime",
          icon: <Cpu />,
          content: (
            <>
              <Runtime />
            </>
          ),
        },
        {
          key: "Settings",
          icon: <Settings />,
          content: (
            <>
              <Heading size="2">Site Settings</Heading>
              <SidebarSettings />
            </>
          ),
        },
      ]}
    />
  );
}

function RepoSize() {
  // Y.encodeStateAsUpdate(ydoc);
  const ydoc = useAtomValue(ATOM_ydoc);
  const size = Y.encodeStateAsUpdate(ydoc).byteLength;
  const [b, setB] = useState(false);
  useEffect(() => {
    const interval = setInterval(
      () => {
        setB(!b);
      },
      // update every 10s
      10000
    );
    return () => clearInterval(interval);
  }, [b]);
  return <Flex>Size: {prettyPrintBytes(size)}</Flex>;
}

export function SidebarRight() {
  return (
    <MyTabs
      side="right"
      tabs={[
        {
          key: "Files",
          icon: <Files />,
          // content: "Make changes to your account.".repeat(10),
          content: (
            <Flex direction="column">
              <Heading mb="2" size="2">
                Right Sidebar
              </Heading>
              <FpsMeter />
              <RepoSize />
            </Flex>
          ),
        },
        { key: "Search", icon: <Search />, content: "Search".repeat(10) },
        {
          key: "Outline",
          icon: <ListTree />,
          content: (
            <>
              <Heading size="2">Table of Pods</Heading>
              <TableofPods />
            </>
          ),
        },
        {
          key: "Settings",
          icon: <Settings />,
          content: (
            <>
              <Heading size="2">Site Settings</Heading>
              <SidebarSettings />
            </>
          ),
        },
      ]}
    />
  );
}
