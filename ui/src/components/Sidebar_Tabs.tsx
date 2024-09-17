import { useEffect, useContext, useState } from "react";
import { useParams } from "react-router-dom";

import { Text, Tabs, Tooltip as RadixTooltip, Box } from "@radix-ui/themes";

import { gray, mauve, violet } from "@radix-ui/colors";

const MyTabsRoot = ({
  tabs,
  side,
  defaultValue,
  children,
}: {
  tabs: { key: string; icon: any; content: any }[];
  side: "left" | "right";
  defaultValue?: string;
  children: any;
}) => {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(true);
  return (
    <Tabs.Root
      orientation="vertical"
      value={value}
      style={{
        display: "flex",
        flexDirection: "row",
        // The sidebar tabs should be scrollable.
        overflow: "scroll",
      }}
    >
      {open && side === "right" && children}
      <Tabs.List
        style={{
          flexDirection: "column",
          backgroundColor: "#eee",
          border: "1px solid black",
          alignItems: "flex-start",
          zIndex: 2,
        }}
      >
        {tabs.map(({ key, icon }) => (
          <Tabs.Trigger
            key={key}
            value={key}
            style={{
              ...(key === value ? { color: "red" } : {}),
              justifyContent: "flex-start",
            }}
            onClick={(event) => {
              event.preventDefault();
              if (value === key) {
                setOpen(!open);
                // setValue("");
              } else {
                setOpen(true);
                setValue(key);
              }
            }}
          >
            <RadixTooltip content={key} delayDuration={100} side="right">
              {icon}
            </RadixTooltip>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {open && side === "left" && children}
    </Tabs.Root>
  );
};

export function MyTabs({
  tabs,
  side = "left",
  defaultValue,
}: {
  tabs: { key: string; icon: any; content: any }[];
  side: "left" | "right";
  defaultValue?: string;
}) {
  return (
    <MyTabsRoot tabs={tabs} side={side} defaultValue={defaultValue}>
      <Box
        style={{
          border: "1px solid black",
          width: "200px",
          backgroundColor: gray.gray1,
          // The sidebar panel should be scrollable.
          overflow: "scroll",
          padding: "1rem",
        }}
      >
        <>
          {tabs.map(({ key, content }) => (
            <Tabs.Content
              key={key}
              value={key}
              style={{
                height: "100%",
              }}
            >
              {content}
            </Tabs.Content>
          ))}
        </>
      </Box>
    </MyTabsRoot>
  );
}
