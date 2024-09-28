import { InfoCircledIcon } from "@radix-ui/react-icons";
import { Callout, Link } from "@radix-ui/themes";
import { Link as ReactLink } from "react-router-dom";

export function NoLogginErrorAlert() {
  return (
    <Callout.Root color="red">
      <Callout.Icon>
        <InfoCircledIcon />
      </Callout.Icon>
      <Callout.Text>
        Please <Link href="/api/auth/signin">login</Link> to view this page.
      </Callout.Text>
    </Callout.Root>
  );
}
