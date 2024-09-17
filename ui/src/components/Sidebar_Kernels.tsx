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
} from "@radix-ui/themes";

import { Power, Play, RefreshCcw, CircleStop } from "lucide-react";

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
import { useAtom, useAtomValue, useSetAtom } from "jotai";
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

import { toast } from "react-toastify";

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

export const Runtime = () => {
  return (
    <Flex direction={"column"} gap="2">
      <Heading size="2" my="3">
        runtime
      </Heading>

      <KernelStatus kernelName="python" />
      <KernelStatus kernelName="julia" />
      <KernelStatus kernelName="javascript" />
      <KernelStatus kernelName="racket" />
    </Flex>
  );
};
