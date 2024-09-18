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
  AlertDialog,
} from "@radix-ui/themes";

import { repo2ipynb } from "./nodes/utils";

import { myassert } from "@/lib/utils/utils";
import { toSvg } from "html-to-image";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ATOM_codeMap,
  ATOM_nodesMap,
  ATOM_resultMap,
  ATOM_ydoc,
} from "@/lib/store/yjsSlice";

import * as Y from "yjs";

import { ATOM_repoData } from "@/lib/store/atom";
import { yjsTrpc } from "@/lib/trpc";

function downloadLink(dataUrl: string, fileName: string) {
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

function getDateString() {
  // Format the date as save-pdf_20240916-1118
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  const dateString = `${year}${month}${day}-${hours}${minutes}`;
  return dateString;
}

/**
 * Use the default letter size. This is good for printing. User can adjust
 * portrait/landscape mode and the size of the paper.
 */
export function ExportPDF() {
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
      const dateString = getDateString();

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

/**
 * Download the ydoc, mainly for debugging.
 */
export function ExportYDoc() {
  const ydoc = useAtomValue(ATOM_ydoc);
  const [loading, setLoading] = useState(false);
  const repoData = useAtomValue(ATOM_repoData);
  myassert(repoData);
  const onClick = () => {
    setLoading(true);
    const update = Y.encodeStateAsUpdate(ydoc);
    // update is a Uint8Array
    const blob = new Blob([update], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const dateString = getDateString();
    const a = document.createElement("a");
    a.href = url;
    const filename =
      (repoData.name || "Untitled").replaceAll(" ", "-") + "_" + dateString;
    a.download = filename + ".ydoc";
    a.click();
    setLoading(false);
  };
  return (
    <Button variant="outline" size="1" onClick={onClick} disabled={loading}>
      Download as YDoc
    </Button>
  );
}

export function ImportYDoc() {
  const repoData = useAtomValue(ATOM_repoData);
  const restoreYDoc = yjsTrpc.restoreYDoc.useMutation({
    onSuccess: () => {
      // refresh the page
      window.location.reload();
    },
  });
  myassert(repoData);
  const onClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ydoc";
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files) return;
      const file = files[0];
      const reader = new FileReader();
      reader.onload = async (e) => {
        const buffer = e.target?.result;
        if (!buffer) return;
        const update = new Uint8Array(buffer as ArrayBuffer);
        const base64String = btoa(String.fromCharCode(...update));

        // const doc = new Y.Doc();
        // Y.applyUpdate(doc, update);
        // setYdoc(doc);

        restoreYDoc.mutate({ repoId: repoData.id, yDocBlob: base64String });
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  };
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>
        <Button variant="outline" color="red" size="1">
          Import YDoc
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="450px">
        <AlertDialog.Title>Import from yDoc file</AlertDialog.Title>
        <AlertDialog.Description size="2">
          Are you sure? This will overwrite the current document.
        </AlertDialog.Description>

        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray">
              Cancel
            </Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button variant="solid" color="red" onClick={onClick}>
              Select file
            </Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
