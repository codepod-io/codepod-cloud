# CodePod Helm chart

This helm chart is used for development.

1. It uses local docker images.
2. It mounts the host src dir into the k8s pods, so that the app is hot-reloaded
   when the src files change.

# Prepare

Install Docker desktop and enable k8s in settings.

Clone the codepod-cloud repository, into path `/path/to/codepod-cloud`.

# Deploy

1. create namespace

```sh
kubectl create ns codepod-dev
kubectl create ns codepod-dev-runtime
```

2. edit configuration values and perform helm install:

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

3. Edit the ingress

4. Install app

```sh
# THEN:
helm install codepod . -n codepod-dev --values=./.values/dev.yaml
helm upgrade codepod . -n codepod-dev --values=./.values/dev.yaml
helm uninstall codepod -n codepod-dev
```

5. First time pnpm package install

Open a terminal in the `codepod-init` pod and run:

```sh
corepack enable && pnpm i
```

7. run prisma db push in api pod

8. redeploy the api/ui/yjs/runtime containers (to load prisma generated npm pkg)

# Maintainence

1. Just repeat step 4 helm install/update app.
2. When db schema changed, use prisma db push to push to the DB. Run prisma db migrate dev to commit to git.
