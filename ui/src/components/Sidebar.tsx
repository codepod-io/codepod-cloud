import { useEffect, useContext, useState, memo } from "react";

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
  RadioGroup,
  RadioCards,
  Popover,
  TextArea,
} from "@radix-ui/themes";

import {
  Files,
  File,
  Search,
  ListTree,
  Cpu,
  Settings,
  Construction,
  CircleHelp,
  TextCursor,
  Move,
  Unplug,
  Play,
  ArrowLeft,
  ArrowRight,
  Pencil,
  Trash2,
  ListVideo,
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
  ATOM_disableCodeRewrite,
  ATOM_showLineNumbers,
} from "@/lib/store/settingSlice";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ATOM_foldAll,
  ATOM_jumpBack,
  ATOM_jumpForward,
  ATOM_jumpIndex,
  ATOM_jumps,
  ATOM_jumpToPod,
  ATOM_nodes,
  ATOM_onetimeCenterPod,
  ATOM_pinnedPods,
  ATOM_search,
  ATOM_selectedPods,
  ATOM_selectPod,
  ATOM_unfoldAll,
  ATOM_updateView,
} from "@/lib/store/canvasSlice";
import {
  ATOM_addSubpage,
  ATOM_codeMap,
  ATOM_deleteSubpage,
  ATOM_nodesMap,
  ATOM_renameSubpage,
  ATOM_resultMap,
  ATOM_richMap,
  ATOM_runtimeMap,
  ATOM_subpageMap,
  ATOM_subpages,
  ATOM_ydoc,
  ATOM_yjsStatus,
  ATOM_yjsSyncStatus,
  getOrCreate_ATOM_runtimeReady,
} from "@/lib/store/yjsSlice";
import { ATOM_currentPage, ATOM_repoData } from "@/lib/store/atom";
import { FpsMeter } from "@/lib/FpsMeter";

import { toast } from "react-toastify";
import {
  ATOM_getSubpageChain,
  ATOM_parseAllPods,
  ATOM_preprocessChain,
  ATOM_propagateAllST,
  ATOM_resolveAllPods,
} from "@/lib/store/runtimeSlice";
import { Runtime } from "./Sidebar_Kernels";
import { ExportPDF, ExportYDoc, ImportYDoc } from "./Sidebar_Download";
import { MyTabs } from "./Sidebar_Tabs";
import { TableofPods } from "./Sidebar_ToC";
import { css } from "@emotion/css";
import { MyMonaco } from "./MyMonaco";
import { Language, ResultBlock } from "./nodes/Code";
import { MyCodeMirror } from "./MyCodeMirror";

function SidebarSettings() {
  const [showLineNumbers, setShowLineNumbers] = useAtom(ATOM_showLineNumbers);
  const [copilotManualMode, setCopilotManualMode] = useAtom(
    ATOM_copilotManualMode
  );
  const [debugMode, setDebugMode] = useAtom(ATOM_debugMode);
  const [disableCodeRewrite, setDisableCodeRewrite] = useAtom(
    ATOM_disableCodeRewrite
  );
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
      <Tooltip side="right" content={"Disable Code Rewrite"}>
        <Flex gap="3" align="center">
          <Switch
            size="3"
            checked={disableCodeRewrite}
            onClick={(e) => {
              setDisableCodeRewrite(!disableCodeRewrite);
              // updateUserSetting.mutate({
              //   disableCodeRewrite: !disableCodeRewrite,
              // });
            }}
          />
          <Text size="3">Disable Code Rewrite</Text>
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
  const yjsUtil = yjsTrpc.useUtils();
  const createVersion = yjsTrpc.createVersion.useMutation({
    onError(error) {
      toast.error(error.message);
    },
    onSuccess() {
      toast.success("Version created.");
      utils.repo.repo.invalidate();
      yjsUtil.getPreviousVersion.invalidate();
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
    <Flex
      direction="column"
      gap="3"
      style={{
        maxHeight: "200px",
        overflowY: "auto",
      }}
    >
      <Heading size="2" my="3">
        Versions ({repoData.versions.length})
      </Heading>

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
    </Flex>
  );
}

function SearchPanel() {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const search = useSetAtom(ATOM_search);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    {
      id: string;
      text: string;
      matches: {
        start: number;
        end: number;
      }[];
    }[]
  >([]);

  const jumpToPod = useSetAtom(ATOM_jumpToPod);

  return (
    <Flex
      direction="column"
      gap="3"
      // style={{
      //   maxHeight: "200px",
      //   overflowY: "auto",
      // }}
    >
      <Heading size="2">Search</Heading>
      <TextField.Root
        placeholder="Search"
        onChange={(e) => setQuery(e.target.value)}
      />
      <Button
        variant="outline"
        disabled={query.length === 0 && results.length === 0}
        onClick={() => {
          if (query.length === 0) {
            setResults([]);
            return;
          }
          const results = search(query);
          console.log("results", results);
          setResults(results);
        }}
      >
        {query.length === 0 && results.length > 0 ? "Clear" : "Search"}
      </Button>
      {/* result */}
      {results.map((r) => (
        <Flex key={r.id} direction="column" gap="3">
          <Button
            onClick={() => {
              jumpToPod(r.id);
            }}
            variant="outline"
            style={{
              alignSelf: "flex-start",
            }}
            size="1"
          >
            {r.id.substring(0, 7)}
          </Button>
          <Flex
            direction="column"
            gap="3"
            style={{
              paddingLeft: "15px",
            }}
          >
            {r.matches.map((m) => (
              <div key={m.start}>
                <code
                  style={{
                    color: "gray",
                    whiteSpace: "pre",
                  }}
                >
                  {r.text.substring(m.start - 20, m.start)}
                </code>
                <code
                  style={{
                    color: "red",
                    whiteSpace: "pre",
                  }}
                >
                  {/* white space should count */}
                  {r.text.substring(m.start, m.end)}
                </code>
                <code
                  style={{
                    color: "gray",
                    whiteSpace: "pre",
                  }}
                >
                  {r.text.substring(m.end, m.end + 20)}
                </code>
              </div>
            ))}
          </Flex>
        </Flex>
      ))}
    </Flex>
  );
}

/************************************************************
 * Subpage
 ************************************************************/

function SubpagePanel() {
  const [currentPage, setCurrengPage] = useAtom(ATOM_currentPage);
  const updateView = useSetAtom(ATOM_updateView);
  const subpages = useAtomValue(ATOM_subpages);
  const addSubpage = useSetAtom(ATOM_addSubpage);
  const [title, setTitle] = useState("");
  const getSubpageChain = useSetAtom(ATOM_getSubpageChain);
  const preprocessChain = useSetAtom(ATOM_preprocessChain);
  const runChain = runtimeTrpc.k8s.runChain.useMutation();
  const repoData = useAtomValue(ATOM_repoData);
  myassert(repoData);
  return (
    <Flex direction="column" gap="3">
      <Flex gap="1">
        <Heading size="2">Subpage</Heading>
        {/* grow */}
        <Flex flexGrow="1" />
        {/* The button to run all pages. */}
        <Button
          variant="soft"
          onClick={async () => {
            // Run all subpages
            const chain = getSubpageChain(undefined);
            subpages.forEach((s) => {
              chain.push(...getSubpageChain(s.id));
            });
            const specs = await preprocessChain(chain);
            if (specs.length > 0) {
              runChain.mutate({ repoId: repoData.id, specs });
            }
          }}
        >
          <ListVideo />
        </Button>
        <Popover.Root>
          <Popover.Trigger>
            <Button variant="soft">Add</Button>
          </Popover.Trigger>
          <Popover.Content width="360px">
            <Flex gap="3">
              <Box flexGrow="1">
                <TextArea
                  placeholder="Write a title…"
                  onChange={(e) => setTitle(e.target.value)}
                />
                <Flex gap="3" mt="3">
                  <Flex flexGrow={"1"} />
                  <Popover.Close>
                    <Button
                      size="1"
                      disabled={title.length === 0}
                      onClick={() => {
                        addSubpage(title);
                      }}
                    >
                      Add
                    </Button>
                  </Popover.Close>
                </Flex>
              </Box>
            </Flex>
          </Popover.Content>
        </Popover.Root>
      </Flex>
      <RadioCards.Root
        value={currentPage ?? "main"}
        columns={{ initial: "1" }}
        onValueChange={(v: string) => {
          if (v === "main") {
            setCurrengPage(undefined);
          } else {
            setCurrengPage(v);
          }
          updateView();
        }}
      >
        {/* The "main" subpage. */}
        <Flex align="center" gap="3">
          <RadioCards.Item
            value="main"
            style={{
              flexGrow: 1,
            }}
          >
            <Flex direction="row" width="100%" gap="3">
              <File />
              <Text weight="bold">Main</Text>
            </Flex>
          </RadioCards.Item>
          <Button
            variant="soft"
            onClick={async () => {
              const chain = getSubpageChain(undefined);
              const specs = await preprocessChain(chain);
              if (specs.length > 0) {
                runChain.mutate({ repoId: repoData.id, specs });
              }
            }}
          >
            <Play />
          </Button>
        </Flex>

        {/* The subpages. */}
        {subpages.map(({ id, title }) => (
          <Flex align="center" gap="3" key={id}>
            <RadioCards.Item
              value={id}
              style={{
                flexGrow: 1,
              }}
            >
              <Flex direction="row" width="100%" gap="3">
                <File />
                <Text weight="bold">{title}</Text>
              </Flex>
            </RadioCards.Item>
            <SubpageMenu id={id} />
          </Flex>
        ))}
      </RadioCards.Root>
    </Flex>
  );
}

function SubpageMenu({ id }: { id: string }) {
  const subpageMap = useAtomValue(ATOM_subpageMap);
  const subpage = subpageMap.get(id);
  const renameSubpage = useSetAtom(ATOM_renameSubpage);
  const deleteSubpage = useSetAtom(ATOM_deleteSubpage);
  myassert(subpage);
  const [title, setTitle] = useState(subpage.title);
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const nodes = Array.from(nodesMap.values());
  const subpageNodes = nodes.filter((n) => n.data.subpageId === id);
  const subpageRefs = nodes.filter(
    (n) => n.type === "SubpageRef" && n.data.refId === id
  );
  const getSubpageChain = useSetAtom(ATOM_getSubpageChain);
  const preprocessChain = useSetAtom(ATOM_preprocessChain);
  const runChain = runtimeTrpc.k8s.runChain.useMutation();
  const repoData = useAtomValue(ATOM_repoData);
  myassert(repoData);

  return (
    <Flex gap="1">
      {/* Run this subpage button. */}
      <Button
        variant="soft"
        onClick={async () => {
          const chain = getSubpageChain(id);
          const specs = await preprocessChain(chain);
          if (specs.length > 0) {
            runChain.mutate({ repoId: repoData.id, specs });
          }
        }}
      >
        <Play />
      </Button>
      {/* Rename the title. */}
      <Popover.Root>
        <Popover.Trigger>
          <Button variant="soft">
            <Pencil />
          </Button>
        </Popover.Trigger>
        <Popover.Content width="360px">
          <Flex gap="3">
            <Box flexGrow="1">
              <TextArea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Flex gap="3" mt="3">
                <Flex flexGrow={"1"} />
                <Popover.Close>
                  <Button
                    size="1"
                    disabled={title.length === 0}
                    onClick={() => {
                      renameSubpage(id, title);
                    }}
                  >
                    Rename
                  </Button>
                </Popover.Close>
              </Flex>
            </Box>
          </Flex>
        </Popover.Content>
      </Popover.Root>
      {/* Delete the subpage. */}
      <Popover.Root>
        <Tooltip content="Can only delete a subpage when (1) it's empty and (2) there's no ref to it.">
          <Popover.Trigger>
            <Button
              variant="soft"
              color="red"
              disabled={subpageNodes.length > 0 || subpageRefs.length > 0}
            >
              <Trash2 />
            </Button>
          </Popover.Trigger>
        </Tooltip>
        <Popover.Content width="360px">
          <Flex gap="3">
            <Box flexGrow="1">
              This will delete this subpage. Continue?
              <Flex gap="3" mt="3">
                <Flex flexGrow={"1"} />
                <Popover.Close>
                  <Button
                    size="1"
                    onClick={() => {
                      deleteSubpage(id);
                    }}
                    color="red"
                  >
                    Delete
                  </Button>
                </Popover.Close>
              </Flex>
            </Box>
          </Flex>
        </Popover.Content>
      </Popover.Root>
    </Flex>
  );
}

function JumpPanel() {
  const jumps = useAtomValue(ATOM_jumps);
  const jumpIndex = useAtomValue(ATOM_jumpIndex);
  const jumpBack = useSetAtom(ATOM_jumpBack);
  const jumpForward = useSetAtom(ATOM_jumpForward);
  return (
    <Flex direction="column" gap="3">
      <Heading size="2">Jump</Heading>
      {/* <Text>Jumps: {JSON.stringify(jumps)}</Text> */}
      {/* <Text>JumpIndex: {jumpIndex}</Text> */}

      <Flex gap="3">
        <IconButton
          variant="outline"
          onClick={() => {
            jumpBack();
          }}
          disabled={jumpIndex <= 0}
        >
          <ArrowLeft />
        </IconButton>
        <IconButton
          variant="outline"
          onClick={() => {
            jumpForward();
          }}
          disabled={jumpIndex >= jumps.length - 1}
        >
          <ArrowRight />
        </IconButton>
      </Flex>
    </Flex>
  );
}

/************************************************************
 * Debug Panel
 ************************************************************/

function DebugPanel() {
  const parseAllPods = useSetAtom(ATOM_parseAllPods);
  const propagateAllSt = useSetAtom(ATOM_propagateAllST);
  const resolveAllPods = useSetAtom(ATOM_resolveAllPods);
  const selectedPods = useAtomValue(ATOM_selectedPods);
  const updateView = useSetAtom(ATOM_updateView);
  const foldAll = useSetAtom(ATOM_foldAll);
  const unfoldAll = useSetAtom(ATOM_unfoldAll);
  const repoData = useAtomValue(ATOM_repoData);
  myassert(repoData);
  const repoId = repoData.id;
  return (
    <Flex direction="column" gap="1">
      <YjsSyncStatus />
      <Separator my="3" size="4" />
      <JumpPanel />
      <Separator my="3" size="4" />
      <SubpagePanel />
      <Separator my="3" size="4" />
      <Flex>
        <Text>Selected: {selectedPods.size}</Text>
      </Flex>
      <Heading size="2">Export to ..</Heading>
      <ExportPDF />
      <ExportYDoc />
      <ImportYDoc />

      <Separator my="3" size="4" />
      <Button
        onClick={async () => {
          await parseAllPods();
          updateView();
        }}
        variant="outline"
      >
        Parse All
      </Button>
      <Button
        onClick={() => {
          propagateAllSt();
          updateView();
        }}
        variant="outline"
      >
        Propagate All
      </Button>
      <Button
        onClick={() => {
          resolveAllPods();
          updateView();
        }}
        variant="outline"
      >
        Resolve All
      </Button>
      <Button
        onClick={async () => {
          await parseAllPods();
          propagateAllSt();
          resolveAllPods();
          updateView();
        }}
        variant="outline"
      >
        Parse 3
      </Button>
      <Separator my="3" size="4" />
      <Button
        onClick={() => {
          foldAll();
        }}
        variant="outline"
      >
        Fold All
      </Button>
      <Button
        onClick={() => {
          unfoldAll();
        }}
        variant="outline"
        // disabled
      >
        Unfold All
      </Button>
      <Runtime />
    </Flex>
  );
}

export function SidebarLeft() {
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
              <Separator my="3" size="4" />
              <Runtime />
            </Flex>
          ),
        },
        ...(debugMode
          ? [
              {
                key: "Debug",
                icon: <Construction />,
                content: <DebugPanel />,
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
      {/* <Flex
        style={{
          paddingLeft: "15px",
        }}
        direction="column"
      >
        {nodes.map(({ id }) => (
          <Box key={id}>{id.substring(0, 6)}</Box>
        ))}
      </Flex> */}

      <Box>nodesMap: {nodesMap.size} </Box>
      {/* <Flex
        style={{
          paddingLeft: "15px",
        }}
        direction="column"
      >
        {Array.from(nodesMap.keys()).map((key) => (
          <Box key={key}>{key.substring(0, 6)}</Box>
        ))}
      </Flex> */}
      <Box>
        Code: {codeMap.size} {codeMap.keys()}
      </Box>
      {/* <Flex
        style={{
          paddingLeft: "15px",
        }}
        direction="column"
      >
        {Array.from(codeMap.keys()).map((key) => (
          <Box key={key}>{key.substring(0, 6)}</Box>
        ))}
      </Flex> */}
      <Box>
        Rich: {richMap.size} {richMap.keys()}
      </Box>
      {/* <Flex
        style={{
          paddingLeft: "15px",
        }}
        direction="column"
      >
        {Array.from(richMap.keys()).map((key) => (
          <Box key={key}>{key.substring(0, 6)}</Box>
        ))}
      </Flex> */}
    </Flex>
  );
}

const PinnedPod = memo(function PinnedPod({ id }: { id: string }) {
  const nodesMap = useAtomValue(ATOM_nodesMap);
  const node = nodesMap.get(id);

  const setOnetimeCenterPod = useSetAtom(ATOM_onetimeCenterPod);

  const preprocessChain = useSetAtom(ATOM_preprocessChain);
  const runChain = runtimeTrpc.k8s.runChain.useMutation();
  const repoData = useAtomValue(ATOM_repoData);
  myassert(repoData);
  myassert(node);
  myassert(node.type === "CODE");
  const runtimeReady = useAtomValue(
    getOrCreate_ATOM_runtimeReady(node.data.lang)
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Flex>
        <Button
          onClick={() => {
            setOnetimeCenterPod(id);
          }}
          variant="outline"
          style={{
            alignSelf: "flex-start",
          }}
          size="1"
        >
          {id.substring(0, 7)}
        </Button>
        <Flex flexGrow="1" />
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
            if (specs.length > 0)
              runChain.mutate({ repoId: repoData.id, specs });
          }}
        >
          <Play />
        </IconButton>
      </Flex>
      <div
        style={{
          position: "relative",
          border: "1px solid var(--gray-3)",
        }}
      >
        {/* <MyMonaco id={id} /> */}
        <MyCodeMirror id={id} />
        <Language lang={node.data.lang} />
      </div>
      <ResultBlock id={id} />
    </div>
  );
});

function PinnedPodList() {
  const pinnedPods = useAtomValue(ATOM_pinnedPods);
  return (
    <Flex direction="column" gap="3">
      <Heading size="2">Pinned Pods</Heading>
      {Array.from(pinnedPods).map((id) => (
        <Box key={id}>
          <PinnedPod id={id} />
        </Box>
      ))}
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
            <Flex direction="column" gap="3">
              <Versions />
              <SearchPanel />
              {/* <Heading size="2" my="3">
                ToC
              </Heading> */}
              {/* ToC has a HUGE performance hit. */}
              {/* <TableofPods /> */}
            </Flex>
          ),
        },
        ...(debugMode
          ? [
              {
                key: "Debug",
                icon: <Construction />,
                content: (
                  <Flex direction="column" gap="3">
                    <Heading mb="2" size="2">
                      Right Sidebar
                    </Heading>
                    <FpsMeter />
                    <Separator my="3" size="4" />
                    <Versions />
                    <Separator my="3" size="4" />
                    <PinnedPodList />
                    <Separator my="3" size="4" />
                    <SearchPanel />
                    {/* <Heading size="2">ToC</Heading> */}
                    {/* <TableofPods /> */}
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
