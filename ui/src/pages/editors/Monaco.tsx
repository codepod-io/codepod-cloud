import { useCallback, useEffect, useRef, useState } from "react";
import * as monaco from "monaco-editor";
import { css } from "@emotion/css";
import { cmAPI, crepeAPI, markdown } from "./atom";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";

export function TestMonaco() {
  const editorRef = useRef(null);
  const [content, setContent] = useAtom(markdown);

  let [editor, setEditor] =
    useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  const setCmAPI = useSetAtom(cmAPI);

  // const crepeAPIValue = useAtomValue(crepeAPI);

  const onCodemirrorChange = useAtomCallback(
    useCallback((get, _set, content: string) => {
      const crepeAPIValue = get(crepeAPI);
      crepeAPIValue.update(content);
    }, [])
  );

  useEffect(() => {
    if (editorRef.current) {
      const editor = monaco.editor.create(editorRef.current, {
        // value: `function hello() {
        //   alert('Hello world!');
        // }`,
        value: content,
        language: "markdown",
        selectOnLineNumbers: true,
        fontSize: 14,
        // This scrollBeyondLastLine is super important. Without this, it will
        // try to adjust height infinitely.
        scrollBeyondLastLine: false,
        folding: false,
        lineNumbersMinChars: 3,
        wordWrap: "on",
        wrappingStrategy: "advanced",
        minimap: {
          enabled: false,
        },
        formatOnPaste: true,
        formatOnType: true,
        autoIndent: "full",
        // autoIndent: true,
        overviewRulerLanes: 0,
        automaticLayout: true,
        scrollbar: {
          alwaysConsumeMouseWheel: false,
          vertical: "hidden",
        },
        renderLineHighlight: "line",
        renderLineHighlightOnlyWhenFocus: true,
      });

      setEditor(editor);

      editor.onDidChangeModelContent(() => {
        console.log("????");
        // setContent(editor.getValue());
        // crepeAPIValue.update(editor.getValue());
        // console.log("loaded", crepeAPIValue.loaded);
        // crepeAPIValue.update("111");
        // onCodemirrorChange(editor.getValue());
      });

      setCmAPI({
        loaded: true,
        update: (markdown: string) => {
          // const state = createCodeMirrorState({
          //   onChange,
          //   setFocus,
          //   dark,
          //   content: markdown,
          // });
          // editor.setState(state);
          editor.setValue(markdown);
        },
      });

      return () => {
        if (editor) {
          editor.dispose();
        }
        setCmAPI({
          loaded: false,
          update: () => {},
        });
        setEditor(null);
      };
    }
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
      }}
      className={css`
        .monaco-editor {
          outline: 0;
          border-radius: 4px;
        }
        .overflow-guard {
          border-radius: 4px;
        }
      `}
      ref={editorRef}
    />
  );
}
