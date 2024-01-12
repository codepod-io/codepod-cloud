/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import "./index.css";

import { $isCodeHighlightNode } from "@lexical/code";
import { $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  $INTERNAL_isPointSelection,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  LexicalEditor,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";
import * as React from "react";
import { createPortal } from "react-dom";

import * as Toolbar from "@radix-ui/react-toolbar";
import {
  StrikethroughIcon,
  TextAlignLeftIcon,
  TextAlignCenterIcon,
  TextAlignRightIcon,
  FontBoldIcon,
  FontItalicIcon,
  CaretDownIcon,
} from "@radix-ui/react-icons";

import { getDOMRangeRect } from "../../utils/getDOMRangeRect";
import { getSelectedNode } from "../../utils/getSelectedNode";
import { setFloatingElemPosition } from "../../utils/setFloatingElemPosition";
import DropdownColorPicker from "../../ui/DropdownColorPicker";
import {
  $getSelectionStyleValueForProperty,
  $patchStyleText,
} from "@lexical/selection";
import { Code, Link, Underline } from "lucide-react";
import { Button, Flex } from "@radix-ui/themes";
import { DropdownMenu } from "@radix-ui/themes";
import { match } from "ts-pattern";

function ColorPicker({ editor, fontColor, bgColor }) {
  type Style = "red" | "green" | "blue" | "bg-yellow" | "bg-pink" | "none";
  const style = match({ fontColor, bgColor })
    .with({ fontColor: "red" }, () => "red")
    .with({ fontColor: "green" }, () => "green")
    .with({ fontColor: "blue" }, () => "blue")
    .with({ bgColor: "yellow" }, () => "bg-yellow")
    .with({ bgColor: "pink" }, () => "bg-pink")
    .otherwise(() => "none") as Style;
  const applyStyleText = useCallback(
    (styles: Record<string, string>, skipHistoryStack?: boolean) => {
      editor.update(
        () => {
          const selection = $getSelection();
          if ($INTERNAL_isPointSelection(selection)) {
            $patchStyleText(selection, styles);
          }
        },
        skipHistoryStack ? { tag: "historic" } : {}
      );
    },
    [editor]
  );
  const onFontColorSelect = useCallback(
    (value: string, skipHistoryStack: boolean) => {
      applyStyleText({ color: value }, skipHistoryStack);
    },
    [applyStyleText]
  );
  const onBgColorSelect = useCallback(
    (value: string, skipHistoryStack: boolean) => {
      applyStyleText({ "background-color": value }, skipHistoryStack);
    },
    [applyStyleText]
  );
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <Button
          variant="ghost"
          className="hover:bg-violet3 hover:text-violet11 hover:border-emerald-400"
          style={{
            height: "0.7em",
            color: fontColor,
            backgroundColor: bgColor,
          }}
        >
          A
          <CaretDownIcon />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <Flex>
          <DropdownMenu.Item
            style={{
              border: style === "none" ? "2px solid" : "",
              padding: "5px",
              height: "1.6em",
            }}
            onClick={() => {
              onFontColorSelect("black", false);
              onBgColorSelect("white", false);
            }}
          >
            A
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={" text-red-500"}
            style={{
              border: style === "red" ? "2px solid" : "",
              padding: "5px",
              height: "1.6em",
            }}
            onClick={() => {
              onFontColorSelect("red", false);
              onBgColorSelect("white", false);
            }}
          >
            A
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={" text-green-500"}
            style={{
              border: style === "green" ? "2px solid" : "",
              padding: "5px",
              height: "1.6em",
              marginLeft: "1px",
            }}
            onClick={() => {
              onFontColorSelect("green", false);
              onBgColorSelect("white", false);
            }}
          >
            A
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={" text-blue-500"}
            style={{
              border: style === "blue" ? "2px solid" : "",
              padding: "5px",
              height: "1.6em",
              marginLeft: "1px",
            }}
            onClick={() => {
              onFontColorSelect("blue", false);
              onBgColorSelect("white", false);
            }}
          >
            A
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={" bg-yellow-200"}
            style={{
              border: style === "bg-yellow" ? "2px solid" : "",
              padding: "5px",
              height: "1.6em",
              marginLeft: "1px",
            }}
            onClick={() => {
              onFontColorSelect("black", false);
              onBgColorSelect("yellow", false);
            }}
          >
            A
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={" bg-pink-200"}
            style={{
              border: style === "bg-pink" ? "2px solid" : "",
              padding: "5px",
              height: "1.6em",
              marginLeft: "1px",
            }}
            onClick={() => {
              onFontColorSelect("black", false);
              onBgColorSelect("pink", false);
            }}
          >
            A
          </DropdownMenu.Item>
        </Flex>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

function TextFormatFloatingToolbar({
  editor,
  anchorElem,
  isLink,
  isBold,
  isItalic,
  isUnderline,
  isCode,
  isStrikethrough,
  fontColor,
  bgColor,
}: {
  editor: LexicalEditor;
  anchorElem: HTMLElement;
  isBold: boolean;
  isCode: boolean;
  isItalic: boolean;
  isLink: boolean;
  isStrikethrough: boolean;
  isUnderline: boolean;
  fontColor: string;
  bgColor: string;
}): JSX.Element {
  const popupCharStylesEditorRef = useRef<HTMLDivElement | null>(null);

  const insertLink = useCallback(() => {
    if (!isLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, "https://");
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    }
  }, [editor, isLink]);

  // const insertComment = () => {
  //   editor.dispatchCommand(INSERT_INLINE_COMMAND, undefined);
  // };

  function mouseMoveListener(e: MouseEvent) {
    if (
      popupCharStylesEditorRef?.current &&
      (e.buttons === 1 || e.buttons === 3)
    ) {
      if (popupCharStylesEditorRef.current.style.pointerEvents !== "none") {
        const x = e.clientX;
        const y = e.clientY;
        const elementUnderMouse = document.elementFromPoint(x, y);

        if (!popupCharStylesEditorRef.current.contains(elementUnderMouse)) {
          // Mouse is not over the target element => not a normal click, but probably a drag
          popupCharStylesEditorRef.current.style.pointerEvents = "none";
        }
      }
    }
  }
  function mouseUpListener(e: MouseEvent) {
    if (popupCharStylesEditorRef?.current) {
      if (popupCharStylesEditorRef.current.style.pointerEvents !== "auto") {
        popupCharStylesEditorRef.current.style.pointerEvents = "auto";
      }
    }
  }

  useEffect(() => {
    if (popupCharStylesEditorRef?.current) {
      document.addEventListener("mousemove", mouseMoveListener);
      document.addEventListener("mouseup", mouseUpListener);

      return () => {
        document.removeEventListener("mousemove", mouseMoveListener);
        document.removeEventListener("mouseup", mouseUpListener);
      };
    }
  }, [popupCharStylesEditorRef]);

  const updateTextFormatFloatingToolbar = useCallback(() => {
    const selection = $getSelection();

    const popupCharStylesEditorElem = popupCharStylesEditorRef.current;
    const nativeSelection = window.getSelection();

    if (popupCharStylesEditorElem === null) {
      return;
    }

    const rootElement = editor.getRootElement();
    if (
      selection !== null &&
      nativeSelection !== null &&
      !nativeSelection.isCollapsed &&
      rootElement !== null &&
      rootElement.contains(nativeSelection.anchorNode)
    ) {
      const rangeRect = getDOMRangeRect(nativeSelection, rootElement);

      setFloatingElemPosition(
        rangeRect,
        popupCharStylesEditorElem,
        anchorElem,
        isLink
      );
    }
  }, [editor, anchorElem, isLink]);

  useEffect(() => {
    const scrollerElem = anchorElem.parentElement;

    const update = () => {
      editor.getEditorState().read(() => {
        updateTextFormatFloatingToolbar();
      });
    };

    window.addEventListener("resize", update);
    if (scrollerElem) {
      scrollerElem.addEventListener("scroll", update);
    }

    return () => {
      window.removeEventListener("resize", update);
      if (scrollerElem) {
        scrollerElem.removeEventListener("scroll", update);
      }
    };
  }, [editor, updateTextFormatFloatingToolbar, anchorElem]);

  useEffect(() => {
    editor.getEditorState().read(() => {
      updateTextFormatFloatingToolbar();
    });
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateTextFormatFloatingToolbar();
        });
      }),

      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateTextFormatFloatingToolbar();
          return false;
        },
        COMMAND_PRIORITY_LOW
      )
    );
  }, [editor, updateTextFormatFloatingToolbar]);

  const itemClasses1 = [
    "flex-shrink-0 flex-grow-0 basis-auto ",
    "text-mauve11 h-[25px] px-[5px] rounded inline-flex text-[13px] leading-none",
    "items-center justify-center bg-white ml-0.5 outline-none",
    "hover:bg-violet3 hover:text-violet11 focus:relative focus:shadow-[0_0_0_2px]",
    "focus:shadow-violet7 first:ml-0",
  ].join(" ");

  return (
    <div
      ref={popupCharStylesEditorRef}
      style={{
        background: "#fff",
        // padding: "4px",
        verticalAlign: "middle",
        position: "absolute",
        top: "0",
        left: "0",
        zIndex: 10,
        opacity: 0,
        boxShadow: "0px 5px 10px rgba(0, 0, 0, 0.3)",
        borderRadius: "8px",
        transition: "opacity 0.5s",
        height: "35px",
        willChange: "transform",
      }}
    >
      {editor.isEditable() && (
        <>
          <Toolbar.Root
            className="flex px-[10px] py-[5px] w-full min-w-max rounded-md bg-white shadow-[0_2px_10px] shadow-blackA4"
            aria-label="Formatting options"
          >
            <Toolbar.Button
              onClick={() => {
                editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
              }}
              className={[
                itemClasses1,
                isBold ? "text-violet11 bg-violet5" : "",
              ].join(" ")}
              value="bold"
              aria-label="Bold"
            >
              <FontBoldIcon />
            </Toolbar.Button>

            {/* italic */}
            <Toolbar.Button
              onClick={() => {
                editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
              }}
              className={[
                itemClasses1,
                isItalic ? "text-violet11 bg-violet5" : "",
              ].join(" ")}
              value="italic"
              aria-label="Italic"
            >
              <FontItalicIcon />
            </Toolbar.Button>

            {/* underline */}
            <Toolbar.Button
              onClick={() => {
                editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline");
              }}
              className={[
                itemClasses1,
                isUnderline ? "text-violet11 bg-violet5" : "",
              ].join(" ")}
              value="underline"
              aria-label="Underline"
            >
              <Underline size={12} />
            </Toolbar.Button>

            {/* strikethrough */}
            <Toolbar.Button
              onClick={() => {
                editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough");
              }}
              className={[
                itemClasses1,
                isStrikethrough ? "text-violet11 bg-violet5" : "",
              ].join(" ")}
              value="strikethrough"
              aria-label="Strike through"
            >
              <StrikethroughIcon />
            </Toolbar.Button>

            {/* code */}
            <Toolbar.Button
              onClick={() => {
                editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code");
              }}
              className={[
                itemClasses1,
                isCode ? "text-violet11 bg-violet5" : "",
              ].join(" ")}
              value="code"
              aria-label="Insert code block"
            >
              <Code size={12} />
            </Toolbar.Button>

            {/* link */}
            <Toolbar.Button
              onClick={insertLink}
              className={[
                itemClasses1,
                isLink ? "text-violet11 bg-violet5" : "",
              ].join(" ")}
              value="link"
              aria-label="Insert link"
            >
              <Link size={12} />
            </Toolbar.Button>

            <Toolbar.Button
              className={itemClasses1}
              value="color"
              aria-label="Font color"
              style={{
                padding: "10px",
              }}
            >
              <ColorPicker
                editor={editor}
                fontColor={fontColor}
                bgColor={bgColor}
              />
            </Toolbar.Button>
          </Toolbar.Root>
        </>
      )}
    </div>
  );
}

function useFloatingTextFormatToolbar(
  editor: LexicalEditor,
  anchorElem: HTMLElement
): JSX.Element | null {
  const [isText, setIsText] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [fontColor, setFontColor] = useState<string>("black");
  const [bgColor, setBgColor] = useState<string>("white");

  const updatePopup = useCallback(() => {
    editor.getEditorState().read(() => {
      // Should not to pop up the floating toolbar when using IME input
      if (editor.isComposing()) {
        return;
      }
      const selection = $getSelection();
      const nativeSelection = window.getSelection();
      const rootElement = editor.getRootElement();

      if (
        nativeSelection !== null &&
        (!$isRangeSelection(selection) ||
          rootElement === null ||
          !rootElement.contains(nativeSelection.anchorNode))
      ) {
        setIsText(false);
        return;
      }

      if (!$isRangeSelection(selection)) {
        return;
      }

      const node = getSelectedNode(selection);

      // Update text format
      setIsBold(selection.hasFormat("bold"));
      setIsItalic(selection.hasFormat("italic"));
      setIsUnderline(selection.hasFormat("underline"));
      setIsStrikethrough(selection.hasFormat("strikethrough"));
      setIsCode(selection.hasFormat("code"));

      setFontColor(
        $getSelectionStyleValueForProperty(selection, "color", "black")
      );
      setBgColor(
        $getSelectionStyleValueForProperty(
          selection,
          "background-color",
          "white"
        )
      );

      // Update links
      const parent = node.getParent();
      if ($isLinkNode(parent) || $isLinkNode(node)) {
        setIsLink(true);
      } else {
        setIsLink(false);
      }

      if (
        !$isCodeHighlightNode(selection.anchor.getNode()) &&
        selection.getTextContent() !== ""
      ) {
        setIsText($isTextNode(node) || $isParagraphNode(node));
      } else {
        setIsText(false);
      }

      const rawTextContent = selection.getTextContent().replace(/\n/g, "");
      if (!selection.isCollapsed() && rawTextContent === "") {
        setIsText(false);
        return;
      }
    });
  }, [editor]);

  useEffect(() => {
    document.addEventListener("selectionchange", updatePopup);
    return () => {
      document.removeEventListener("selectionchange", updatePopup);
    };
  }, [updatePopup]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(() => {
        updatePopup();
      }),
      editor.registerRootListener(() => {
        if (editor.getRootElement() === null) {
          setIsText(false);
        }
      })
    );
  }, [editor, updatePopup]);

  if (!isText) {
    return null;
  }

  return createPortal(
    <div>
      <TextFormatFloatingToolbar
        editor={editor}
        anchorElem={anchorElem}
        isLink={isLink}
        isBold={isBold}
        isItalic={isItalic}
        isStrikethrough={isStrikethrough}
        isUnderline={isUnderline}
        isCode={isCode}
        fontColor={fontColor}
        bgColor={bgColor}
      />

      {/* <Toolbar2 /> */}
    </div>,
    anchorElem
  );
}

export default function FloatingTextFormatToolbarPlugin({
  anchorElem = document.body,
}: {
  anchorElem?: HTMLElement;
}): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  return useFloatingTextFormatToolbar(editor, anchorElem);
}
