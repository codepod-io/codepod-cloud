import { useEffect, useState } from "react";

import { Link as ReactLink, useNavigate } from "react-router-dom";

import { useAuth } from "@/lib/auth";
import { GoogleSignin } from "./login";
import { trpc } from "@/lib/trpc";
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Link,
  TextField,
} from "@radix-ui/themes";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { toast } from "react-toastify";
import { FieldApi, useForm } from "@tanstack/react-form";
import { z } from "zod";

function FieldInfo({ field }: { field: FieldApi<any, any, any, any> }) {
  return (
    <>
      {field.state.meta.isTouched && field.state.meta.errors.length ? (
        <em style={{ color: "red" }}>{field.state.meta.errors.join(",")}</em>
      ) : null}
      {field.state.meta.isValidating ? (
        <div style={{ color: "blue" }}>"Validating..."</div>
      ) : null}
    </>
  );
}

function FieldInfoPassword({ field }: { field: FieldApi<any, any, any, any> }) {
  const errors = field.state.meta.errors;
  const error = errors.length > 0 && errors[0];
  const result = {
    "8 characters long": false,
    "one uppercase letter": false,
    "one lowercase letter": false,
    "one digit": false,
  };
  if (error) {
    error.includes("8 characters long") && (result["8 characters long"] = true);
    error.includes("one uppercase letter") &&
      (result["one uppercase letter"] = true);
    error.includes("one lowercase letter") &&
      (result["one lowercase letter"] = true);
    error.includes("one digit") && (result["one digit"] = true);
  }
  return (
    <>
      {field.state.meta.isTouched && (
        <>
          {/* <em style={{ color: "red" }}>{field.state.meta.errors.join(",")}</em> */}
          {Object.keys(result).map((key) => (
            <Box>
              <em
                style={{
                  color: result[key] ? "red" : "green",
                }}
              >
                {key}
              </em>
            </Box>
          ))}
        </>
      )}
      {field.state.meta.isValidating ? (
        <div style={{ color: "blue" }}>"Validating..."</div>
      ) : null}
    </>
  );
}

function TanstackForm() {
  const { isSignedIn, signIn } = useAuth();
  let navigate = useNavigate();
  useEffect(() => {
    if (isSignedIn()) {
      navigate("/");
    }
  });
  const login = trpc.user.signup.useMutation({
    onSuccess: (data) => {
      if (data.token) {
        signIn(data.token);
        navigate("/");
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  const form = useForm({
    defaultValues: {
      firstname: "",
      lastname: "",
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      login.mutate(value);
    },
    validatorAdapter: zodValidator(),
  });
  const [showPassword, setShowPassword] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      style={{
        width: "100%",
      }}
    >
      <Flex direction="column" gap="3">
        <div>
          <form.Field
            name="firstname"
            validators={{
              onChange: z.string().min(1, "First name is required"),
            }}
            children={(field) => (
              <>
                {/* <label htmlFor={field.name}>Email:</label> */}
                <TextField.Root
                  placeholder="First Name"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                ></TextField.Root>
                <FieldInfo field={field} />
              </>
            )}
          />
        </div>
        <div>
          <form.Field
            name="lastname"
            validators={{
              onChange: z.string().min(1, "Last name is required"),
            }}
            children={(field) => (
              <>
                {/* <label htmlFor={field.name}>Email:</label> */}
                <TextField.Root
                  placeholder="Last Name"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                ></TextField.Root>
                <FieldInfo field={field} />
              </>
            )}
          />
        </div>
        <div>
          <form.Field
            name="email"
            validators={{
              onChange: z.string().email(),
            }}
            children={(field) => (
              <>
                {/* <label htmlFor={field.name}>Email:</label> */}
                <TextField.Root
                  placeholder="Email"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                ></TextField.Root>
                <FieldInfo field={field} />
              </>
            )}
          />
        </div>
        <div>
          <form.Field
            name="password"
            validators={{
              // onChange: z
              //   .string()
              //   .min(8, "Password must be at least 8 characters long")
              //   .regex(
              //     /[A-Z]/,
              //     "Password must contain at least one uppercase letter"
              //   )
              //   .regex(
              //     /[a-z]/,
              //     "Password must contain at least one lowercase letter"
              //   )
              //   .regex(/[0-9]/, "Password must contain at least one digit")
              //   .regex(
              //     /[^A-Za-z0-9]/,
              //     "Password must contain at least one special character"
              //   ),
              onChange: z
                .string()
                .min(8, "8 characters long")
                .regex(/[A-Z]/, "one uppercase letter")
                .regex(/[a-z]/, "one lowercase letter")
                .regex(/[0-9]/, "one digit"),
            }}
            children={(field) => (
              <>
                {/* <label htmlFor={field.name}>Password:</label> */}
                <TextField.Root
                  placeholder="Password"
                  type={showPassword ? "text" : "password"}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                >
                  <TextField.Slot></TextField.Slot>
                  <TextField.Slot>
                    <Button
                      variant="ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowPassword(!showPassword);
                      }}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </Button>
                  </TextField.Slot>
                </TextField.Root>
                <FieldInfoPassword field={field} />
              </>
            )}
          />
        </div>
        {/* <Button type="submit">Submit</Button> */}
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? "..." : "Sign Up"}
            </Button>
          )}
        />
      </Flex>
    </form>
  );
}

export function SignUp() {
  return (
    <Container flexGrow={"1"} size="1">
      <Flex direction="column" gap="6">
        <Flex style={{ backgroundColor: "red" }} flexGrow="1"></Flex>
        <Heading
          as="h1"
          size="8"
          style={{
            // center the heading
            textAlign: "center",
          }}
        >
          Sign Up to Your Account
        </Heading>

        {/* Option 1: OAuth */}
        <GoogleSignin />

        {/* A seperator. */}
        <h2
          style={{
            textAlign: "center",
            borderBottom: "1px solid lightgray",
            lineHeight: "0.1em",
            margin: "10px 0",
          }}
        >
          <span style={{ background: "white", padding: "0 10px" }}>
            Or continue with password
          </span>
        </h2>

        {/* Option 2: Email and Password. */}
        <TanstackForm />
        <Flex>
          <Flex>
            <Link href="#">Forgot password?</Link>
          </Flex>
          <Flex flexGrow={"1"} />
          <Flex gap="2">
            Already have an account?
            <Link asChild>
              <ReactLink to="/login">{" Log In"}</ReactLink>
            </Link>
          </Flex>
        </Flex>
      </Flex>
    </Container>
  );
}
