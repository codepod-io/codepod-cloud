import { useEffect, useContext, useState } from "react";

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
  Switch,
  AlertDialog,
} from "@radix-ui/themes";

import {
  Files,
  Search,
  ListTree,
  Cpu,
  Settings,
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
  ATOM_debugMode,
  ATOM_showLineNumbers,
} from "@/lib/store/settingSlice";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ATOM_autoLayoutTree,
  ATOM_centerSelection,
  ATOM_nodes,
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

import { toast } from "react-toastify";
import {
  ATOM_parseAllPods,
  ATOM_propagateAllST,
  ATOM_resolveAllPods,
} from "@/lib/store/runtimeSlice";
import { Runtime } from "./Sidebar_Kernels";
import { ExportPDF, ExportYDoc, ImportYDoc } from "./Sidebar_Download";
import { MyTabs } from "./Sidebar_Tabs";
import { TableofPods } from "./Sidebar_ToC";
import { css } from "@emotion/css";

function SidebarSettings() {
  const [showLineNumbers, setShowLineNumbers] = useAtom(ATOM_showLineNumbers);
  const [copilotManualMode, setCopilotManualMode] = useAtom(
    ATOM_copilotManualMode
  );
  const [debugMode, setDebugMode] = useAtom(ATOM_debugMode);
  const updateUserSetting = trpc.user.updateUserSetting.useMutation();

  return (
    <Flex direction={"column"} gap="2">
      <Tooltip side="right" content={"Show Line Numbers"}>
        <Flex gap="3" align="center">
          <Switch
            size="3"
            checked={showLineNumbers}
            onClick={(e) => {
              setShowLineNumbers(!showLineNumbers);
              updateUserSetting.mutate({
                showLineNumbers: !showLineNumbers,
              });
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
          <Switch
            size="3"
            checked={copilotManualMode}
            onClick={(e) => {
              setCopilotManualMode(!copilotManualMode);
            }}
            disabled
          />
          <Text size="3">Trigger Copilot Manually</Text>
        </Flex>
      </Tooltip>
      <Separator size="4" />
      <Tooltip side="right" content={"Debug Mode"}>
        <Flex gap="3" align="center">
          <Switch
            size="3"
            checked={debugMode}
            onClick={(e) => {
              setDebugMode(!debugMode);
              updateUserSetting.mutate({
                debugMode: !debugMode,
              });
            }}
          />
          <Text size="3">Debug Mode</Text>
        </Flex>
      </Tooltip>
    </Flex>
  );
}

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
        Server:
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
        Status:
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
  const restoreVersion = yjsTrpc.restoreVersion.useMutation({
    onSuccess() {
      // reload the page
      window.location.reload();
    },
  });
  return (
    <Flex direction="column" gap="3">
      <Heading size="2" my="3">
        Versinos ({repoData.versions.length})
      </Heading>
      {repoData.versions.map((v) => (
        <Flex
          key={v.id}
          direction="column"
          className={css`
            &:hover {
              background-color: var(--gray-3);
            }
          `}
        >
          <Flex gap="3" align="center">
            <Box>{v.message}</Box>

            <Flex flexGrow="1" />

            <AlertDialog.Root>
              <AlertDialog.Trigger>
                <Button variant="outline" color="red" size="1">
                  Restore
                </Button>
              </AlertDialog.Trigger>
              <AlertDialog.Content maxWidth="450px">
                <AlertDialog.Title>Restore to version</AlertDialog.Title>
                <AlertDialog.Description size="2">
                  Are you sure? The current changes will be lost.
                </AlertDialog.Description>

                <Flex direction="column" mt="5">
                  <Flex gap="3">
                    Version:
                    <Text color="blue">{v.message}</Text>
                  </Flex>
                  <Text color="gray">
                    Committed {timeDifference(new Date(), new Date(v.time))} ago
                  </Text>
                </Flex>

                <Flex gap="3" mt="4" justify="end">
                  <AlertDialog.Cancel>
                    <Button variant="soft" color="gray">
                      Cancel
                    </Button>
                  </AlertDialog.Cancel>
                  <AlertDialog.Action>
                    <Button
                      variant="solid"
                      color="red"
                      onClick={() => {
                        restoreVersion.mutate({
                          repoId: repoData.id,
                          versionId: v.id,
                        });
                      }}
                    >
                      Restore
                    </Button>
                  </AlertDialog.Action>
                </Flex>
              </AlertDialog.Content>
            </AlertDialog.Root>
          </Flex>
          <Text color="gray">
            {timeDifference(new Date(), new Date(v.time))} ago
          </Text>
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
  const debugMode = useAtomValue(ATOM_debugMode);
  return (
    <MyTabs
      side="left"
      defaultValue={debugMode ? "Debug" : "Files"}
      tabs={[
        {
          key: "Files",
          icon: <Files />,
          // content: "Make changes to your account.".repeat(10),
          content: (
            <Flex direction="column" gap="1">
              <YjsSyncStatus />
              <Heading size="2" my="3">
                Export to ..
              </Heading>
              <ExportPDF />
              <Runtime />
            </Flex>
          ),
        },
        ...(debugMode
          ? [
              {
                key: "Debug",
                icon: <Construction />,
                content: (
                  <Flex direction="column" gap="1">
                    <YjsSyncStatus />
                    <Heading size="2">Export to ..</Heading>
                    <ExportPDF />
                    <ExportYDoc />
                    <ImportYDoc />
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
            ]
          : []),
        // { key: "Search", icon: <Search />, content: "Search".repeat(10) },
        {
          key: "Settings",
          icon: <Settings />,
          content: (
            <>
              <Heading size="2" my="3">
                Site Settings
              </Heading>
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
  const debugMode = useAtomValue(ATOM_debugMode);
  return (
    <MyTabs
      side="right"
      defaultValue={debugMode ? "Debug" : "Index"}
      tabs={[
        {
          key: "Index",
          icon: <ListTree />,
          // content: "Make changes to your account.".repeat(10),
          content: (
            <Flex direction="column">
              <Versions />
              <Heading size="2" my="3">
                ToC
              </Heading>
              <TableofPods />
            </Flex>
          ),
        },
        ...(debugMode
          ? [
              {
                key: "Debug",
                icon: <Construction />,
                content: (
                  <Flex direction="column">
                    <Heading mb="2" size="2">
                      Right Sidebar
                    </Heading>
                    <FpsMeter />
                    <Versions />
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
            ]
          : []),
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
