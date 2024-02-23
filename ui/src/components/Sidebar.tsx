import { useEffect, useContext, useState } from "react";
import { useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import Popover from "@mui/material/Popover";
import StopIcon from "@mui/icons-material/Stop";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import Drawer from "@mui/material/Drawer";
import MenuList from "@mui/material/MenuList";
import MenuItem from "@mui/material/MenuItem";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemButton from "@mui/material/ListItemButton";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import Typography from "@mui/material/Typography";
import TreeView from "@mui/lab/TreeView";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TreeItem from "@mui/lab/TreeItem";

import { useSnackbar, VariantType } from "notistack";

import {
  Text,
  Tabs,
  Tooltip as RadixTooltip,
  Separator,
  Heading,
  Flex,
} from "@radix-ui/themes";

import { gray, mauve, violet } from "@radix-ui/colors";
import { AnimatePresence, motion } from "framer-motion";

import { Files, Search, ListTree, Cpu, Settings } from "lucide-react";

import { sortNodes, downloadLink, repo2ipynb } from "./nodes/utils";

import {
  FormControlLabel,
  FormGroup,
  Stack,
  Switch,
  Slider,
  Input,
  Grid,
  Paper,
  Menu,
} from "@mui/material";
import { getUpTime, myNanoId } from "@/lib/utils/utils";
import { toSvg } from "html-to-image";
import { match } from "ts-pattern";

import { runtimeTrpc, trpc } from "@/lib/trpc";
import {
  ATOM_copilotManualMode,
  ATOM_devMode,
  ATOM_scopedVars,
  ATOM_showAnnotations,
  ATOM_showLineNumbers,
} from "@/lib/store/settingSlice";
import { useAtom, useSetAtom } from "jotai";
import {
  ATOM_autoLayoutTree,
  ATOM_centerSelection,
  ATOM_messUp,
  ATOM_selectedPods,
  ATOM_selectPod,
} from "@/lib/store/canvasSlice";
import { ATOM_activeRuntime } from "@/lib/store/runtimeSlice";
import {
  ATOM_codeMap,
  ATOM_nodesMap,
  ATOM_resultMap,
  ATOM_runtimeChanged,
  ATOM_runtimeMap,
  ATOM_yjsStatus,
  ATOM_yjsSyncStatus,
} from "@/lib/store/yjsSlice";
import {
  ATOM_error,
  ATOM_node2children,
  ATOM_repoId,
  ATOM_repoName,
} from "@/lib/store/atom";

function SidebarSettings() {
  const [scopedVars, setScopedVars] = useAtom(ATOM_scopedVars);
  const [showAnnotations, setShowAnnotations] = useAtom(ATOM_showAnnotations);
  const [devMode, setDevMode] = useAtom(ATOM_devMode);
  const [showLineNumbers, setShowLineNumbers] = useAtom(ATOM_showLineNumbers);
  const [copilotManualMode, setCopilotManualMode] = useAtom(
    ATOM_copilotManualMode
  );
  const autoLayoutTree = useSetAtom(ATOM_autoLayoutTree);

  return (
    <Box>
      <Box>
        <Tooltip title={"Show Line Numbers"} disableInteractive>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={showLineNumbers}
                  size="small"
                  color="warning"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setShowLineNumbers(event.target.checked);
                  }}
                />
              }
              label="Show Line Numbers"
            />
          </FormGroup>
        </Tooltip>
        <Tooltip
          title={"Enable Debug Mode, e.g., show pod IDs"}
          disableInteractive
        >
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={devMode}
                  size="small"
                  color="warning"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setDevMode(event.target.checked);
                  }}
                />
              }
              label="Debug Mode"
            />
          </FormGroup>
        </Tooltip>
        <Tooltip title={"Enable Scoped Variables"} disableInteractive>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={scopedVars}
                  size="small"
                  color="warning"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setScopedVars(event.target.checked);
                  }}
                />
              }
              label="Scoped Variables"
            />
          </FormGroup>
        </Tooltip>
        <Tooltip title={"Show Annotations in Editor"} disableInteractive>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={showAnnotations}
                  size="small"
                  color="warning"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setShowAnnotations(event.target.checked);
                  }}
                />
              }
              label="Enable Annotations"
            />
          </FormGroup>
        </Tooltip>
        <Tooltip
          title={"Ctrl+Shift+Space to trigger Copilot manually"}
          disableInteractive
        >
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={copilotManualMode}
                  size="small"
                  color="warning"
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setCopilotManualMode(event.target.checked);
                  }}
                />
              }
              label="Trigger Copilot Manually"
            />
          </FormGroup>
        </Tooltip>
        {showAnnotations && (
          <Stack spacing={0.5}>
            <Box className="myDecoration-function">Function Definition</Box>
            <Box className="myDecoration-vardef">Variable Definition</Box>
            <Box className="myDecoration-varuse">Function/Variable Use</Box>
            <Box className="myDecoration-varuse my-underline">
              Undefined Variable
            </Box>
          </Stack>
        )}
      </Box>
    </Box>
  );
}

const RuntimeMoreMenu = ({ runtimeId }) => {
  // menu logic
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  // codepod logic
  const [activeRuntime, setActiveRuntime] = useAtom(ATOM_activeRuntime);
  const [repoId] = useAtom(ATOM_repoId);
  if (!repoId) throw new Error("repoId is null");

  const deleteKernel = runtimeTrpc.kernel.delete.useMutation();
  const disconnectKernel = runtimeTrpc.kernel.disconnect.useMutation();

  return (
    <Box component="span">
      <IconButton
        aria-label="more"
        id="long-button"
        aria-controls={open ? "basic-menu" : undefined}
        aria-expanded={open ? "true" : undefined}
        aria-haspopup="true"
        onClick={handleClick}
      >
        <MoreVertIcon />
      </IconButton>
      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "basic-button",
        }}
      >
        <MenuItem
          onClick={() => {
            setActiveRuntime(runtimeId);
            handleClose();
          }}
          disabled={activeRuntime === runtimeId}
        >
          Activate
        </MenuItem>
        <MenuItem
          onClick={() => {
            disconnectKernel.mutate({ runtimeId, repoId });
            handleClose();
          }}
        >
          Disconnect
        </MenuItem>
        <MenuItem
          onClick={() => {
            deleteKernel.mutate({ runtimeId, repoId: repoId });
            handleClose();
          }}
        >
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
};

const RuntimeItem = ({ runtimeId }) => {
  const [runtimeMap] = useAtom(ATOM_runtimeMap);
  // Observe runtime change
  const [runtimeChanged] = useAtom(ATOM_runtimeChanged);
  // A dummy useEffect to indicate that runtimeChanged is used.
  useEffect(() => {}, [runtimeChanged]);
  const [activeRuntime] = useAtom(ATOM_activeRuntime);
  const runtime = runtimeMap.get(runtimeId)!;
  const [repoId] = useAtom(ATOM_repoId);
  if (!repoId) throw new Error("repoId is null");

  const connect = runtimeTrpc.kernel.connect.useMutation();
  const requestKernelStatus = runtimeTrpc.kernel.status.useMutation();
  const interruptKernel = runtimeTrpc.kernel.interrupt.useMutation();

  useEffect(() => {
    // if the runtime is disconnected, keep trying to connect.
    if (runtime.wsStatus !== "connected") {
      const interval = setInterval(
        () => {
          console.log("try connecting to runtime", runtimeId);
          connect.mutate({
            runtimeId,
            repoId,
          });
        },
        // ping every 3 seconds
        3000
      );
      return () => clearInterval(interval);
    }
  }, [runtime]);

  return (
    <Box
      sx={{
        opacity: activeRuntime === runtimeId ? 1 : 0.3,
      }}
    >
      <Paper>
        <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
          ID: {runtimeId.substring(0, 8)}
        </Typography>

        <Typography variant="body1">
          Conn:{" "}
          {match(runtime.wsStatus)
            .with("connected", () => (
              <Box color="green" component="span">
                connected
              </Box>
            ))
            .with("connecting", () => (
              <Box color="yellow" component="span">
                connecting
              </Box>
            ))
            .otherwise(() => (
              <Box color="red" component="span">
                Disconnected{" "}
              </Box>
            ))}
          <RuntimeMoreMenu runtimeId={runtimeId} />
        </Typography>
        <Typography variant="body1">
          Status:{" "}
          {match(runtime.status)
            .with("idle", () => (
              <Box color="green" component="span">
                idle
              </Box>
            ))
            .with("busy", () => (
              <Box color="yellow" component="span">
                busy
              </Box>
            ))
            .otherwise(() => runtime.status)}
          <IconButton
            size="small"
            onClick={() => {
              requestKernelStatus.mutate({
                runtimeId,
              });
            }}
          >
            <RefreshIcon fontSize="inherit" />
          </IconButton>
          <Tooltip title="interrupt">
            <IconButton
              size="small"
              onClick={() => {
                interruptKernel.mutate({
                  runtimeId,
                });
              }}
            >
              <StopIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </Typography>
      </Paper>
    </Box>
  );
};

const RuntimeStatus = () => {
  const [repoId] = useAtom(ATOM_repoId);
  if (!repoId) throw new Error("repoId is null");
  const [runtimeMap] = useAtom(ATOM_runtimeMap);
  // Observe runtime change
  useAtom(ATOM_runtimeChanged);
  const ids = Array.from<string>(runtimeMap.keys());
  const createKernel = runtimeTrpc.kernel.create.useMutation();

  return (
    <>
      <Typography variant="h6">Runtime</Typography>
      <Button
        onClick={() => {
          const id = myNanoId();
          createKernel.mutate({ runtimeId: id, repoId: repoId });
        }}
      >
        Create New Runtime
      </Button>

      {ids.map((runtimeId) => (
        <RuntimeItem key={runtimeId} runtimeId={runtimeId} />
      ))}
    </>
  );
};

function YjsSyncStatus() {
  // FIXME performance issue
  const [yjsStatus] = useAtom(ATOM_yjsStatus);
  const [yjsSyncStatus] = useAtom(ATOM_yjsSyncStatus);
  return (
    <Box>
      <Stack
        direction="row"
        spacing={2}
        sx={{
          alignItems: "center",
        }}
      >
        {/* Synced? <Box>{provider?.synced}</Box> */}
        {/* {yjsStatus} */}
        Sync Server:
        {match(yjsStatus)
          .with("connected", () => <Box color="green">connected</Box>)
          .with("disconnected", () => <Box color="red">disconnected</Box>)
          .with("connecting", () => <Box color="yellow">connecting</Box>)
          // .with("syncing", () => <Box color="green">online</Box>)
          .otherwise(() => `${yjsStatus}`)}
      </Stack>
      <Stack direction="row" spacing={2}>
        Sync Status:
        {match(yjsSyncStatus)
          .with("uploading", () => <Box color="yellow">uploading</Box>)
          .with("synced", () => <Box color="green">synced</Box>)
          .otherwise(() => `Unknown: ${yjsSyncStatus}`)}
      </Stack>
    </Box>
  );
}

function ToastError() {
  const { enqueueSnackbar } = useSnackbar();
  const [error, setError] = useAtom(ATOM_error);
  useEffect(() => {
    if (error) {
      enqueueSnackbar(`ERROR: ${error.msg}`, {
        variant: error.type as VariantType,
      });
      // I'll need to clear this msg once it is displayed
      setError(null);
    }
  }, [enqueueSnackbar, error, setError]);
  return <Box></Box>;
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
    <Button
      variant="outlined"
      size="small"
      color="secondary"
      onClick={onClick}
      disabled={loading}
    >
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
    <Button
      variant="outlined"
      size="small"
      color="secondary"
      onClick={onClick}
      disabled={loading}
    >
      Download Image
    </Button>
  );
}

function ExportButtons() {
  return (
    <Stack spacing={1}>
      <ExportJupyterNB />
      <ExportSVG />
    </Stack>
  );
}

function PodTreeItem({ id, node2children }) {
  const selectPod = useSetAtom(ATOM_selectPod);
  const setSelectedPods = useSetAtom(ATOM_selectedPods);
  const setCenterSelection = useSetAtom(ATOM_centerSelection);

  if (!node2children.has(id)) return null;
  const children = node2children.get(id);
  return (
    <TreeItem
      key={id}
      nodeId={id}
      label={id.substring(0, 8)}
      onClick={() => {
        setSelectedPods(new Set<string>());
        selectPod({ id, selected: true });
        setCenterSelection(true);
      }}
    >
      {children.length > 0 &&
        children.map((child) => (
          <PodTreeItem key={child} id={child} node2children={node2children} />
        ))}
    </TreeItem>
  );
}

function TableofPods() {
  const [node2children] = useAtom(ATOM_node2children);
  // Set all nodes to expanded. Disable the collapse/expand for now.
  const allIds = Array.from(node2children.keys());

  return (
    <TreeView
      aria-label="multi-select"
      defaultCollapseIcon={<ExpandMoreIcon />}
      defaultExpandIcon={<ChevronRightIcon />}
      expanded={allIds}
      multiSelect
    >
      {node2children.size > 0 &&
        node2children!
          .get("ROOT")!
          .map((child) => (
            <PodTreeItem key={child} id={child} node2children={node2children} />
          ))}
    </TreeView>
  );
}

export const Sidebar = () => {
  // never render saving status / runtime module for a guest
  // FIXME: improve the implementation logic
  return (
    <>
      <Box
        sx={{
          padding: "8px 16px",
        }}
      >
        <Stack>
          <Box>
            <YjsSyncStatus />
            <Divider />
            <RuntimeStatus />
          </Box>
          <Divider />
          <Typography variant="h6">Export to ..</Typography>
          <ExportButtons />

          <Divider />
          <Typography variant="h6">Site Settings</Typography>
          <SidebarSettings />
          <ToastError />

          <Divider />
          <Typography variant="h6">Table of Pods</Typography>
          <TableofPods />
        </Stack>
      </Box>
    </>
  );
};

const MyTabsRoot = ({
  tabs,
  children,
}: {
  tabs: { key: string; icon: any; content: any }[];
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
      }}
    >
      <Tabs.List
        style={{
          flexDirection: "column",
          // height: "300px",
          height: "80vh",
          backgroundColor: "#eee",
          border: "1px solid black",
          borderRadius: "10px",
          alignItems: "flex-start",
          zIndex: 2,
        }}
        // make the tabs align left
        // className="flex flex-col justify-start"
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
      <AnimatePresence>{open && children}</AnimatePresence>
    </Tabs.Root>
  );
};

function MyTabs({
  tabs,
}: {
  tabs: { key: string; icon: any; content: any }[];
}) {
  return (
    <MyTabsRoot tabs={tabs}>
      <motion.div
        initial={{ opacity: 0, x: -100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -100 }}
        className="px-4 pt-3 pb-2"
        style={{
          originX: 0,
          originY: 0,
          border: "1px solid black",
          borderRadius: "10px",
          width: "200px",
          backgroundColor: gray.gray1,
        }}
      >
        <>
          {tabs.map(({ key, content }) => (
            <Tabs.Content key={key} value={key}>
              <motion.div
                layoutId="text"
                layout="position"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
              >
                <Text size="2">{content}</Text>
              </motion.div>
            </Tabs.Content>
          ))}
        </>
      </motion.div>
    </MyTabsRoot>
  );
}

export function TabSidebar() {
  const autoLayoutTree = useSetAtom(ATOM_autoLayoutTree);
  const messUp = useSetAtom(ATOM_messUp);
  return (
    <div
      style={{
        position: "absolute",
        zIndex: 100,
        top: "10%",
        left: "10px",
      }}
    >
      <MyTabs
        tabs={[
          {
            key: "Files",
            icon: <Files />,
            // content: "Make changes to your account.".repeat(10),
            content: (
              <Flex direction="column">
                <YjsSyncStatus />
                <Typography variant="h6">Export to ..</Typography>
                <ExportButtons />
                <Separator my="3" size="4" />
                <Heading mb="2" size="4">
                  Experimental
                </Heading>

                <Button
                  onClick={() => {
                    console.log("autolayout tree");
                    autoLayoutTree();
                    console.log("done");
                  }}
                >
                  Layout tree
                </Button>
                <Button
                  onClick={() => {
                    console.log("mess up");
                    messUp();
                    console.log("done");
                  }}
                >
                  Mess Up
                </Button>
              </Flex>
            ),
          },
          { key: "Search", icon: <Search />, content: "Search".repeat(10) },
          {
            key: "Outline",
            icon: <ListTree />,
            content: (
              <>
                <Typography variant="h6">Table of Pods</Typography>
                {/* <TableofPods /> */}
              </>
            ),
          },
          {
            key: "Runtime",
            icon: <Cpu />,
            content: (
              <>
                <RuntimeStatus />
              </>
            ),
          },
          {
            key: "Settings",
            icon: <Settings />,
            content: (
              <>
                <Typography variant="h6">Site Settings</Typography>
                <SidebarSettings />
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
