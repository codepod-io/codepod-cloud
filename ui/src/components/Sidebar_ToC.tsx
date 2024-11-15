import { useEffect, useContext, useState, memo } from "react";
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
  Switch,
} from "@radix-ui/themes";

import {
  ChevronRight,
  ChevronDown,
  NotebookPen,
  Package,
  Construction,
  CircleHelp,
} from "lucide-react";

import { match } from "ts-pattern";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ATOM_nodes,
  ATOM_onetimeCenterPod,
  ATOM_selectedPods,
  ATOM_selectPod,
} from "@/lib/store/canvasSlice";
import {
  ATOM_codeMap,
  ATOM_nodesMap,
  ATOM_provider,
  ATOM_richMap,
} from "@/lib/store/yjsSlice";

import juliaLogo from "@/assets/julia.svg";
import pythonLogo from "@/assets/python.svg";
import javascriptLogo from "@/assets/javascript.svg";
import racketLogo from "@/assets/racket.svg";
import { toast } from "react-toastify";
import { CodeNodeType } from "@/lib/store/types";
import { getOrCreate_ATOM_selfST } from "@/lib/store/runtimeSlice";
import { getTitleFromYXml } from "./nodes/Rich";

function RichNodeName({ id }) {
  const [provider] = useAtom(ATOM_provider);

  const [richMap] = useAtom(ATOM_richMap);
  if (!richMap.has(id)) {
    throw new Error("richMap does not have id " + id);
  }
  const yXml = richMap.get(id);
  if (!yXml) return null;
  if (!provider) return null;
  const title = getTitleFromYXml(yXml);
  if (title) return title;
  return (
    <Text
      style={{
        color: "black",
      }}
    >
      {id.substring(0, 5)}
    </Text>
  );
}

function CodeNodeName({ id }) {
  const selfSt = useAtomValue(getOrCreate_ATOM_selfST(id));
  if (selfSt.size === 0)
    return (
      <Text
        style={{
          color: "black",
        }}
      >
        {id.substring(0, 5)}
      </Text>
    );
  return (
    <Flex align="center">
      <code
        style={{
          // do not wrap
          whiteSpace: "nowrap",
        }}
      >
        {[...selfSt.keys()].join(",")}
      </code>
    </Flex>
  );
}

function NodeName({ id }) {
  const [nodesMap] = useAtom(ATOM_nodesMap);
  const node = nodesMap.get(id);
  if (!node) return null;

  return match(node.type)
    .with("CODE", () => <CodeNodeName id={id} />)
    .with("RICH", () => <RichNodeName id={id} />)
    .with("SCOPE", () => (
      <Text
        style={{
          color: "black",
        }}
      >
        Scope
      </Text>
    ))
    .otherwise(() => <Text>???</Text>);
}

function PodTreeItem({ id }) {
  const [nodesMap] = useAtom(ATOM_nodesMap);
  const node = nodesMap.get(id);
  if (!node) return null;

  const selectPod = useSetAtom(ATOM_selectPod);
  const setSelectedPods = useSetAtom(ATOM_selectedPods);
  const setOnetimeCenterPod = useSetAtom(ATOM_onetimeCenterPod);

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
            .with("SCOPE", () => <Package size={15} />)
            .otherwise(() => (
              <Box>???</Box>
            ))}
        </Box>

        {/* Node name */}
        <Button
          variant="ghost"
          onClick={() => {
            setOnetimeCenterPod(id);
          }}
        >
          <NodeName id={id} />
        </Button>
      </Flex>
      {node.type === "SCOPE" && (
        <Flex direction="column">
          <Flex direction="column" style={{ paddingLeft: "15px" }}>
            {node.data.childrenIds?.map((child) => (
              <PodTreeItem key={child} id={child} />
            ))}
          </Flex>
        </Flex>
      )}
    </Flex>
  );
}

export const TableofPods = memo(function TableofPods() {
  // listen to nodes change.
  const [nodes] = useAtom(ATOM_nodes);
  // get root nodes
  const rootNodes = nodes.filter((node) => !node.parentId);

  return (
    <Box>
      {rootNodes.map((node) => (
        <PodTreeItem key={node.id} id={node.id} />
      ))}
    </Box>
  );
});
