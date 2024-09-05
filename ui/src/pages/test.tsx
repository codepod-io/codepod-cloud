import { Flex } from "@radix-ui/themes";
import { CrepeEditor } from "./editors/Crepe";
import { MilkdownEditorWrapper } from "./editors/Kit";
import { TestMonaco } from "./editors/Monaco";
// import { MilkdownEditorWrapper } from "./editors/Kit";

export function Test() {
  // load the text file from "./editors/template.md"
  return (
    <Flex
      gap="3"
      // align="center"
      justify="center"
      style={{
        // width: "80vw",
        // width: "1000px",
        margin: "auto",
        // width: "2000px",
        // margin: "auto",
        // border: "1px solid black",
        padding: "1rem",
      }}
      // className="prose prose-stone"
    >
      <div
        style={{
          border: "1px solid black",
          width: "45%",
        }}
      >
        <CrepeEditor />
      </div>
      <div
        style={{
          border: "1px solid black",
          width: "45%",
        }}
      >
        <TestMonaco />
      </div>
      {/* <MilkdownEditorWrapper /> */}
    </Flex>
  );
}
