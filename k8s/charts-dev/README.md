# CodePod Helm chart v2

This helm chart is used for development.

1. It uses local docker images.
2. It mounts the host src dir into the k8s pods, so that the app is hot-reloaded
   when the src files change.

# Prepare

Install Docker desktop and enable k8s in settings.

Clone the codepod-cloud repository, into path `/path/to/codepod-cloud`.

# Deploy

create namespace

```sh
kubectl create ns codepod-dev
kubectl create ns codepod-dev-runtime
```

edit configuration values and perform helm install:

```sh
# create a copy of values.yaml
mkdir .values
cp values.yaml .values/dev.yaml
# edit the values
# ...
```

The values:

```yaml
srcDir: "/path/to/codepod-cloud"
# you will also need to set the allowed origins in GCP console for this clientId.
googleClientId:
```

```sh
# THEN:
helm install codepod . -n codepod-dev --values=./.values/dev.yaml
helm upgrade codepod . -n codepod-dev --values=./.values/dev.yaml
helm uninstall codepod -n codepod-dev
```

# First time pnpm package install

Open a terminal in the `codepod-init` pod and run:

```sh
corepack enable && pnpm i
```

# First time DB setup

~~Change api pod's startup command to `tail -f /dev/null`, then run `pnpm dlx prisma migrate dev` in the pod to apply the change, then change back the command.~~

Open a terminal in the `api` pod and run `pnpm dlx prisma db push` to sync the schema with DB.

Here are the commands to work with Prisma schema:

- During development, use `prisma db push`;
- When commiting the schema changes to git, use `prisma migrate dev --name SOME_NAME`;
- For deployment, use `prisma migrate deploy`.
