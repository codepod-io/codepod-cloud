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
  DropdownMenu,
  Dialog,
  TextField,
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
  Package,
  Construction,
  CircleHelp,
} from "lucide-react";

import { repo2ipynb } from "./nodes/utils";

import * as Y from "yjs";

import {
  myassert,
  prettyPrintBytes,
  prettyPrintCPU,
  prettyPrintMemory,
  timeDifference,
  useTick,
} from "@/lib/utils/utils";
import { toSvg } from "html-to-image";
import { match } from "ts-pattern";

import { runtimeTrpc, trpc, yjsTrpc } from "@/lib/trpc";
import {
  ATOM_copilotManualMode,
  ATOM_showLineNumbers,
} from "@/lib/store/settingSlice";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ATOM_autoLayoutTree,
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
  ATOM_richMap,
  ATOM_runtimeChanged,
  ATOM_runtimeMap,
  ATOM_ydoc,
  ATOM_yjsStatus,
  ATOM_yjsSyncStatus,
} from "@/lib/store/yjsSlice";
import { ATOM_repoData } from "@/lib/store/atom";
import { FpsMeter } from "@/lib/FpsMeter";

import juliaLogo from "@/assets/julia.svg";
import pythonLogo from "@/assets/python.svg";
import javascriptLogo from "@/assets/javascript.svg";
import racketLogo from "@/assets/racket.svg";
import { toast } from "react-toastify";
import { CodeNodeType } from "@/lib/store/types";
import {
  ATOM_parseAllPods,
  ATOM_propagateAllST,
  ATOM_resolveAllPods,
} from "@/lib/store/runtimeSlice";

function SidebarSettings() {
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
      </Flex>
    </Box>
  );
}

function KernelStatus({
  kernelName,
}: {
  kernelName: "julia" | "python" | "javascript" | "racket";
}) {
  const repoData = useAtomValue(ATOM_repoData);
  if (!repoData) throw new Error("repoId is null");
  const repoId = repoData.id;
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
  const status = runtimeTrpc.k8s.status.useMutation({
    onError(error) {
      toast.error(error.message);
    },
  });
  const usageStatus = runtimeTrpc.k8s.usageStatus.useMutation({
    onError(error) {
      toast.error(error.message);
    },
  });
  const interrupt = runtimeTrpc.k8s.interrupt.useMutation({
    onError(error) {
      toast.error(error.message);
    },
  });
  const start = runtimeTrpc.k8s.start.useMutation({
    onError(error) {
      toast.error(error.message);
    },
  });
  const stop = runtimeTrpc.k8s.stop.useMutation({
    onError(error) {
      toast.error(error.message);
    },
  });
  // init the kernel status when the component is mounted
  // useEffect(() => {
  //   console.log("init kernel status", repoId, kernelName);
  //   status.mutate({ repoId, kernelName });
  // }, []);

  return (
    <Card>
      <Flex direction={"column"}>
        <Flex align="center">
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
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <Button variant="ghost">
                  <DropdownMenu.TriggerIcon />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                <DropdownMenu.Separator />
                <DropdownMenu.Item
                  onSelect={() => {
                    status.mutate({ repoId, kernelName });
                  }}
                  color="blue"
                >
                  <RefreshCcw /> Refresh
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => {
                    interrupt.mutate({ repoId, kernelName });
                  }}
                  color="pink"
                >
                  <CircleStop />
                  Interrupt
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => {
                    usageStatus.mutate({ repoId, kernelName });
                  }}
                >
                  <RefreshCcw /> Metrics
                </DropdownMenu.Item>

                <DropdownMenu.Separator />
                <DropdownMenu.Item
                  onSelect={() => {
                    stop.mutate({ repoId, kernelName });
                  }}
                  color="red"
                >
                  <Power /> Power Off
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          )}
        </Flex>

        {/* createdAt */}
        <Flex direction="column">
          {runtime && (
            <>
              <CreatedAt
                createdAt={runtime.createdAt}
                recycledAt={runtime.recycledAt}
              />
              {/* the resource usage */}
              {runtime.cpu && <Box>{prettyPrintCPU(runtime.cpu)} vCPU</Box>}
              {runtime.memory && (
                <Box>{prettyPrintMemory(runtime.memory)} MiB</Box>
              )}
            </>
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
  useTick(1000);
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
            <Box style={{ color: "var(--orange-9)" }}>connecting</Box>
          ))
          // .with("syncing", () => <Box color="green">online</Box>)
          .otherwise(() => `${yjsStatus}`)}
      </Flex>
      <Flex direction="row" gap={"2"}>
        Sync Status:
        {match(yjsSyncStatus)
          .with("uploading", () => (
            <Box style={{ color: "var(--orange-9)" }}>uploading</Box>
          ))
          .with("synced", () => <Box style={{ color: "green" }}>synced</Box>)
          .otherwise(() => `Unknown: ${yjsSyncStatus}`)}
      </Flex>
    </Box>
  );
}

function downloadLink(dataUrl, fileName) {
  let element = document.createElement("a");
  element.setAttribute("href", dataUrl);
  element.setAttribute("download", fileName);

  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
}

function ExportJupyterNB() {
  const { id: repoId } = useParams();
  const repoData = useAtomValue(ATOM_repoData);
  myassert(repoData);
  const repoName = repoData.name;
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
  const repoData = useAtomValue(ATOM_repoData);
  myassert(repoData);
  const repoName = repoData.name;
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
      Download SVG
    </Button>
  );
}

/**
 * Use the default letter size. This is good for printing. User can adjust
 * portrait/landscape mode and the size of the paper.
 */
function ExportPDF() {
  const { id: repoId } = useParams();
  const repoData = useAtomValue(ATOM_repoData);
  myassert(repoData);
  const repoName = repoData.name;
  const [loading, setLoading] = useState(false);

  const onClick = () => {
    setLoading(true);
    const elem = document.querySelector(".react-flow");
    if (!elem) return;

    toSvg(elem as HTMLElement, {
      filter: (node) => {
        if (
          node?.classList?.contains("react-flow__minimap") ||
          node?.classList?.contains("react-flow__controls")
        ) {
          return false;
        }
        return true;
      },
    }).then((dataUrl) => {
      // Format the date as save-pdf_20240916-1118
      const now = new Date();

      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");

      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");

      const dateString = `${year}${month}${day}-${hours}${minutes}`;

      // Create a new iframe element
      const iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.left = "-9999px"; // Hide it off-screen

      // Append the iframe to the document
      document.body.appendChild(iframe);

      // Get the iframe's contentWindow
      const iframeWindow = iframe.contentWindow;
      if (iframeWindow) {
        // Save the current title to restore it later
        const originalTitle = document.title;
        // Write the SVG image into the iframe document
        iframeWindow.document.open();
        iframeWindow.document.write(`
          <html>
            <head><title>Print</title></head>
            <body style="margin: 0;">
              <img src="${dataUrl}" style="width: 100%;">
            </body>
          </html>
        `);
        iframeWindow.document.close();

        // Trigger the print dialog for the iframe
        iframeWindow.focus();
        iframeWindow.print();

        // Clean up: restore original title and remove the iframe after printing
        iframeWindow.onafterprint = () => {
          document.title = originalTitle; // Restore the title
          document.body.removeChild(iframe); // Remove the iframe
        };

        // Add date to the document title for printing
        document.title =
          (repoData.name || "Untitled").replaceAll(" ", "-") + "_" + dateString;
      }

      setLoading(false);
    });
  };

  return (
    <Button variant="outline" size="1" onClick={onClick} disabled={loading}>
      Download as PDF
    </Button>
  );
}

function ExportButtons() {
  return (
    <Flex gap={"1"} direction={"column"}>
      {/* <ExportJupyterNB /> */}
      {/* <ExportSVG /> */}
      <ExportPDF />
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
              match((node as CodeNodeType).data.lang)
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
            .with("SCOPE", () => <Package />)
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
        {node.data.treeChildrenIds?.length ? (
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
        <Flex direction="column">
          {node.type === "SCOPE" && (
            <Flex direction="column" style={{ paddingLeft: "15px" }}>
              {node.data.scopeChildrenIds?.map((child) => (
                <PodTreeItem key={child} id={child} />
              ))}
            </Flex>
          )}
          <Flex direction="column" style={{ paddingLeft: "15px" }}>
            {node.data.treeChildrenIds?.map((child) => (
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
  defaultValue,
  children,
}: {
  tabs: { key: string; icon: any; content: any }[];
  side: "left" | "right";
  defaultValue?: string;
  children: any;
}) => {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(true);
  return (
    <Tabs.Root
      orientation="vertical"
      value={value}
      style={{
        display: "flex",
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
            style={{
              ...(key === value ? { color: "red" } : {}),
              justifyContent: "flex-start",
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
  defaultValue,
}: {
  tabs: { key: string; icon: any; content: any }[];
  side: "left" | "right";
  defaultValue?: string;
}) {
  return (
    <MyTabsRoot tabs={tabs} side={side} defaultValue={defaultValue}>
      <Box
        style={{
          border: "1px solid black",
          width: "200px",
          backgroundColor: gray.gray1,
          // The sidebar panel should be scrollable.
          overflow: "scroll",
          padding: "1rem",
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

function Versions() {
  const repoData = useAtomValue(ATOM_repoData);
  myassert(repoData);
  const [message, setMessage] = useState("");
  const utils = trpc.useUtils();
  const createVersion = yjsTrpc.createVersion.useMutation({
    onError(error) {
      toast.error(error.message);
    },
    onSuccess() {
      toast.success("Version created.");
      utils.repo.repo.invalidate();
    },
  });
  useTick(1000);
  return (
    <Flex direction="column">
      <Heading size="2" my="3">
        Versinos ({repoData.versions.length})
      </Heading>
      {repoData.versions.map((v) => (
        <Flex key={v.id} gap="3">
          <Box>{v.message}</Box>
          <Box>{timeDifference(new Date(), new Date(v.time))} ago</Box>
        </Flex>
      ))}
      {/* Open a dialog for user to enter a commit message. */}
      <Dialog.Root>
        <Dialog.Trigger>
          <Button variant="outline" size="1">
            Commit
          </Button>
        </Dialog.Trigger>

        <Dialog.Content maxWidth="450px">
          <Dialog.Title>Commit</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Enter a message to commit a new version.
            {/* TODO show version history */}
            {/* TODO show current changes (loc of changes) */}
          </Dialog.Description>

          <Flex direction="column" gap="3">
            <TextField.Root
              placeholder="Enter a commit message"
              onChange={(e) => {
                setMessage(e.target.value);
              }}
            />
          </Flex>

          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </Dialog.Close>
            <Dialog.Close>
              <Button
                disabled={message.length === 0}
                onClick={() => {
                  createVersion.mutate({ repoId: repoData.id, message });
                }}
              >
                Save
              </Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}

export function SidebarLeft() {
  const autoLayout = useSetAtom(ATOM_autoLayoutTree);
  const parseAllPods = useSetAtom(ATOM_parseAllPods);
  const propagateAllSt = useSetAtom(ATOM_propagateAllST);
  const resolveAllPods = useSetAtom(ATOM_resolveAllPods);
  return (
    <MyTabs
      side="left"
      defaultValue="Files"
      tabs={[
        {
          key: "Files",
          icon: <Files />,
          // content: "Make changes to your account.".repeat(10),
          content: (
            <Flex direction="column" gap="1">
              <YjsSyncStatus />
              <Heading size="2">Export to ..</Heading>
              <ExportButtons />
              <Separator my="3" size="4" />
              <Runtime />
            </Flex>
          ),
        },
        {
          key: "Dev",
          icon: <Construction />,
          content: (
            <Flex direction="column" gap="1">
              <YjsSyncStatus />
              <Heading size="2">Export to ..</Heading>
              <ExportButtons />
              <Separator my="3" size="4" />
              <Button
                onClick={() => {
                  autoLayout();
                }}
                variant="outline"
              >
                Layout
              </Button>
              <Button onClick={() => parseAllPods()} variant="outline">
                Parse All
              </Button>
              <Button onClick={() => propagateAllSt()} variant="outline">
                Propagate All
              </Button>
              <Button onClick={() => resolveAllPods()} variant="outline">
                Resolve All
              </Button>

              <Separator my="3" size="4" />
              <Runtime />
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
  useTick(10000);
  return <Flex>Size: {prettyPrintBytes(size)}</Flex>;
}

function NodesMapInspector() {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const codeMap = useAtomValue(ATOM_codeMap);
  const richMap = useAtomValue(ATOM_richMap);
  const nodes = useAtomValue(ATOM_nodes);
  return (
    <Flex direction="column">
      <Box>Nodes: {nodes.length}</Box>
      <Flex
        style={{
          paddingLeft: "15px",
        }}
        direction="column"
      >
        {nodes.map(({ id }) => (
          <Box key={id}>{id.substring(0, 6)}</Box>
        ))}
      </Flex>

      <Box>nodesMap: {nodesMap.size} </Box>
      <Flex
        style={{
          paddingLeft: "15px",
        }}
        direction="column"
      >
        {Array.from(nodesMap.keys()).map((key) => (
          <Box key={key}>{key.substring(0, 6)}</Box>
        ))}
      </Flex>
      <Box>
        Code: {codeMap.size} {codeMap.keys()}
      </Box>
      <Flex
        style={{
          paddingLeft: "15px",
        }}
        direction="column"
      >
        {Array.from(codeMap.keys()).map((key) => (
          <Box key={key}>{key.substring(0, 6)}</Box>
        ))}
      </Flex>
      <Box>
        Rich: {richMap.size} {richMap.keys()}
      </Box>
      <Flex
        style={{
          paddingLeft: "15px",
        }}
        direction="column"
      >
        {Array.from(richMap.keys()).map((key) => (
          <Box key={key}>{key.substring(0, 6)}</Box>
        ))}
      </Flex>
    </Flex>
  );
}

export function SidebarRight() {
  return (
    <MyTabs
      side="right"
      defaultValue="Files"
      tabs={[
        {
          key: "Files",
          icon: <Files />,
          // content: "Make changes to your account.".repeat(10),
          content: (
            <Flex direction="column">
              <Versions />
              <Heading size="2" my="3">
                ToC
              </Heading>
              <TableofPods />
              <Separator my="3" size="4" />
              <Heading size="2">Meta data</Heading>
              <RepoSize />
            </Flex>
          ),
        },
        {
          key: "Dev",
          icon: <Construction />,
          content: (
            <Flex direction="column">
              <Heading mb="2" size="2">
                Right Sidebar
              </Heading>
              <FpsMeter />
              <Heading size="2">ToC</Heading>
              <TableofPods />
              <Separator my="3" size="4" />
              <Heading size="2">Meta data</Heading>
              <RepoSize />
              <Heading size="2">Debug</Heading>
              <NodesMapInspector />
            </Flex>
          ),
        },
        {
          key: "Help",
          icon: <CircleHelp />,
          content: (
            <Flex direction="column">
              <Heading size="2">Help</Heading>

              <Heading size="2" my="3">
                Syntax Highlighting
              </Heading>
              <Flex direction={"column"} gap={"1"}>
                <Box className="myDecoration-function">Function Definition</Box>
                <Box className="myDecoration-vardef">Variable Definition</Box>
                <Box className="myDecoration-varuse">Function/Variable Use</Box>
                <Box className="myDecoration-varuse my-underline">
                  Undefined Variable
                </Box>
              </Flex>
            </Flex>
          ),
        },
      ]}
    />
  );
}
