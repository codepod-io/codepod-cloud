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
  ATOM_autoLayoutTree,
  ATOM_centerSelection,
  ATOM_nodes,
  ATOM_selectedPods,
  ATOM_selectPod,
  ATOM_toggleFold,
} from "@/lib/store/canvasSlice";
import { ATOM_codeMap, ATOM_nodesMap } from "@/lib/store/yjsSlice";

import juliaLogo from "@/assets/julia.svg";
import pythonLogo from "@/assets/python.svg";
import javascriptLogo from "@/assets/javascript.svg";
import racketLogo from "@/assets/racket.svg";
import { toast } from "react-toastify";
import { CodeNodeType } from "@/lib/store/types";

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

export function TableofPods() {
  // listen to nodes change.
  const [nodes] = useAtom(ATOM_nodes);

  return (
    <Box>
      <PodTreeItem key={"ROOT"} id={"ROOT"} />
    </Box>
  );
}
