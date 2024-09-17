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

import { repo2ipynb } from "./nodes/utils";

import { myassert } from "@/lib/utils/utils";
import { toSvg } from "html-to-image";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ATOM_codeMap,
  ATOM_nodesMap,
  ATOM_resultMap,
} from "@/lib/store/yjsSlice";
import { ATOM_repoData } from "@/lib/store/atom";

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

export function ExportButtons() {
  return (
    <Flex gap={"1"} direction={"column"}>
      {/* <ExportJupyterNB /> */}
      {/* <ExportSVG /> */}
      <ExportPDF />
    </Flex>
  );
}
