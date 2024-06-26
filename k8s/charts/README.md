# CodePod Helm chart v2

This helm chart is used for development.

1. It uses local docker images.
2. It mounts the host src dir into the k8s pods, so that the app is hot-reloaded
   when the src files change.

# Prepare

Install Docker desktop and enable k8s in settings.

# Deploy

create namespace

```sh
kubectl create ns codepod-dev
kubectl create ns codepod-dev-runtime
```

edit configuration values and perform helm install:

```sh
cp values.yaml values.dev.yaml
# edit the values
# THEN:
helm install codepod-dev . -n codepod-dev --values=./values.dev.yaml
helm upgrade codepod-dev . -n codepod-dev --values=./values.dev.yaml
helm uninstall codepod-dev -n codepod-dev
```

# First time DB setup

Change api pod's startup command to `tail -f /dev/null`, then run `pnpm dlx prisma migrate dev` in the pod to apply the change, then change back the command.
