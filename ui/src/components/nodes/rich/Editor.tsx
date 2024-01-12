/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { CharacterLimitPlugin } from "@lexical/react/LexicalCharacterLimitPlugin";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { ClearEditorPlugin } from "@lexical/react/LexicalClearEditorPlugin";
import LexicalClickableLinkPlugin from "@lexical/react/LexicalClickableLinkPlugin";
import { CollaborationPlugin } from "@lexical/react/LexicalCollaborationPlugin";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { HashtagPlugin } from "@lexical/react/LexicalHashtagPlugin";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import useLexicalEditable from "@lexical/react/useLexicalEditable";
import * as React from "react";
import { useEffect, useState } from "react";
import { CAN_USE_DOM } from "shared/canUseDOM";

import { WebsocketProvider } from "y-websocket";
import { Provider } from "@lexical/yjs";

// import { useSettings } from "./context/SettingsContext.tsx";
import { useSharedHistoryContext } from "./context/SharedHistoryContext";
// import ActionsPlugin from './plugins/ActionsPlugin';
import AutocompletePlugin from "./plugins/AutocompletePlugin";
// import AutoEmbedPlugin from './plugins/AutoEmbedPlugin';
import AutoLinkPlugin from "./plugins/AutoLinkPlugin";
import CodeActionMenuPlugin from "./plugins/CodeActionMenuPlugin";
import CodeHighlightPlugin from "./plugins/CodeHighlightPlugin";
// import CollapsiblePlugin from './plugins/CollapsiblePlugin';
// import CommentPlugin from './plugins/CommentPlugin';
import ComponentPickerPlugin from "./plugins/ComponentPickerPlugin";
import ContextMenuPlugin from "./plugins/ContextMenuPlugin";
import DragDropPaste from "./plugins/DragDropPastePlugin";
import DraggableBlockPlugin from "./plugins/DraggableBlockPlugin";
import EmojiPickerPlugin from "./plugins/EmojiPickerPlugin";
import EmojisPlugin from "./plugins/EmojisPlugin";
import EquationsPlugin from "./plugins/EquationsPlugin";
import ExcalidrawPlugin from "./plugins/ExcalidrawPlugin";
// import FigmaPlugin from './plugins/FigmaPlugin';
import FloatingLinkEditorPlugin from "./plugins/FloatingLinkEditorPlugin";
import FloatingTextFormatToolbarPlugin from "./plugins/FloatingTextFormatToolbarPlugin";
import ImagesPlugin from "./plugins/ImagesPlugin";
// import InlineImagePlugin from "./plugins/InlineImagePlugin";
// import KeywordsPlugin from './plugins/KeywordsPlugin';
import { LayoutPlugin } from "./plugins/LayoutPlugin/LayoutPlugin";
import LinkPlugin from "./plugins/LinkPlugin";
// import ListMaxIndentLevelPlugin from './plugins/ListMaxIndentLevelPlugin';
import MarkdownShortcutPlugin from "./plugins/MarkdownShortcutPlugin";
// import {MaxLengthPlugin} from './plugins/MaxLengthPlugin';
import MentionsPlugin from "./plugins/MentionsPlugin";
// import PageBreakPlugin from './plugins/PageBreakPlugin';
// import PollPlugin from './plugins/PollPlugin';
// import SpeechToTextPlugin from './plugins/SpeechToTextPlugin';
// import TabFocusPlugin from './plugins/TabFocusPlugin';
// import TableCellActionMenuPlugin from "./plugins/TableActionMenuPlugin";
// import TableCellResizer from "./plugins/TableCellResizer";
// import TableOfContentsPlugin from './plugins/TableOfContentsPlugin';
import ToolbarPlugin from "./plugins/ToolbarPlugin";
import TreeViewPlugin from "./plugins/TreeViewPlugin";
// import TwitterPlugin from './plugins/TwitterPlugin';
// import YouTubePlugin from './plugins/YouTubePlugin';
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { Doc } from "yjs";

const skipCollaborationInit =
  // @ts-expect-error
  window.parent != null && window.parent.frames.right === window;

function createWebsocketProvider(
  id: string,
  yjsDocMap: Map<string, Doc>
): Provider {
  let doc = yjsDocMap.get(id);

  if (doc === undefined) {
    doc = new Doc();
    yjsDocMap.set(id, doc);
  } else {
    doc.load();
  }

  // @ts-expect-error
  return new WebsocketProvider("ws://localhost:1234/yjs/pod", id, doc, {
    connect: false,
  });
}

/**
 * FIXME
 * 1. Table: bug: https://github.com/facebook/lexical/issues/5411
 * 2. Ctrl-k. Not working: https://github.com/facebook/lexical/issues/2769
 */
export default function Editor({ id }: { id: string }): JSX.Element {
  const { historyState } = useSharedHistoryContext();
  const isEditable = useLexicalEditable();
  const [floatingAnchorElem, setFloatingAnchorElem] =
    useState<HTMLDivElement | null>(null);
  const [isSmallWidthViewport, setIsSmallWidthViewport] =
    useState<boolean>(false);
  const [isLinkEditMode, setIsLinkEditMode] = useState<boolean>(false);

  const onRef = (_floatingAnchorElem: HTMLDivElement) => {
    if (_floatingAnchorElem !== null) {
      setFloatingAnchorElem(_floatingAnchorElem);
    }
  };

  useEffect(() => {
    const updateViewPortWidth = () => {
      const isNextSmallWidthViewport =
        CAN_USE_DOM && window.matchMedia("(max-width: 1025px)").matches;

      if (isNextSmallWidthViewport !== isSmallWidthViewport) {
        setIsSmallWidthViewport(isNextSmallWidthViewport);
      }
    };
    updateViewPortWidth();
    window.addEventListener("resize", updateViewPortWidth);

    return () => {
      window.removeEventListener("resize", updateViewPortWidth);
    };
  }, [isSmallWidthViewport]);

  // TODO toggle colab mode
  const isCollab = true;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Important plugins */}
      <ToolbarPlugin setIsLinkEditMode={setIsLinkEditMode} />

      {floatingAnchorElem && (
        <FloatingTextFormatToolbarPlugin anchorElem={floatingAnchorElem} />
      )}
      <ComponentPickerPlugin />
      {/* Other */}
      <div
        className={`editor-container tree-view`}
        style={{
          position: "relative",
        }}
      >
        {/* {isMaxLength && <MaxLengthPlugin maxLength={30} />} */}
        <DragDropPaste />
        <AutoFocusPlugin />
        <ClearEditorPlugin />

        <EmojiPickerPlugin />
        {/* <AutoEmbedPlugin /> */}

        <MentionsPlugin />
        <EmojisPlugin />
        <HashtagPlugin />
        {/* <KeywordsPlugin /> */}
        {/* <SpeechToTextPlugin /> */}
        <AutoLinkPlugin />
        {/* <CommentPlugin
          providerFactory={isCollab ? createWebsocketProvider : undefined}
        /> */}
        <>
          {isCollab ? (
            <CollaborationPlugin
              id={id}
              providerFactory={createWebsocketProvider}
              shouldBootstrap={!skipCollaborationInit}
            />
          ) : (
            <HistoryPlugin externalHistoryState={historyState} />
          )}
          <RichTextPlugin
            contentEditable={
              <div>
                <div
                  ref={onRef}
                  style={{
                    position: "relative",
                    width: "100%",
                    minHeight: "150px",
                  }}
                >
                  <ContentEditable
                    style={{
                      minHeight: "150px",
                      border: 0,
                      outline: 0,
                      padding: "8px 28px",
                    }}
                  />
                </div>
              </div>
            }
            placeholder={
              <div
                style={{
                  color: "#999",
                  position: "absolute",
                  top: 0,
                  left: 0,
                  padding: "8px 28px",
                  pointerEvents: "none",
                }}
              >
                type / to insert ..
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <MarkdownShortcutPlugin />
          <CodeHighlightPlugin />
          <ListPlugin />
          <CheckListPlugin />
          {/* <ListMaxIndentLevelPlugin maxDepth={7} /> */}
          <TablePlugin hasCellMerge={true} hasCellBackgroundColor={true} />
          {/* <TableCellResizer /> */}
          <ImagesPlugin />
          {/* <InlineImagePlugin /> */}
          <LinkPlugin />
          {/* <PollPlugin /> */}
          {/* <TwitterPlugin /> */}
          {/* <YouTubePlugin /> */}
          {/* <FigmaPlugin /> */}
          {!isEditable && <LexicalClickableLinkPlugin />}
          <HorizontalRulePlugin />
          <EquationsPlugin />
          <ExcalidrawPlugin />
          {/* <TabFocusPlugin /> */}
          <TabIndentationPlugin />
          {/* <CollapsiblePlugin /> */}
          {/* <PageBreakPlugin /> */}
          <LayoutPlugin />
          {floatingAnchorElem && !isSmallWidthViewport && (
            <>
              <DraggableBlockPlugin anchorElem={floatingAnchorElem} />
              <CodeActionMenuPlugin anchorElem={floatingAnchorElem} />
              <FloatingLinkEditorPlugin
                anchorElem={floatingAnchorElem}
                isLinkEditMode={isLinkEditMode}
                setIsLinkEditMode={setIsLinkEditMode}
              />
              {/* <TableCellActionMenuPlugin
                  anchorElem={floatingAnchorElem}
                  cellMerge={true}
                /> */}
            </>
          )}
        </>

        <AutocompletePlugin />
        {/* <div>{showTableOfContents && <TableOfContentsPlugin />}</div> */}
        <ContextMenuPlugin />
        {/* <ActionsPlugin isRichText={isRichText} /> */}
      </div>
      {/* for debugging */}
      {/* <TreeViewPlugin /> */}
    </div>
  );
}
