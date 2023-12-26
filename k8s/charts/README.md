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
```

edit configuration values and perform helm install:

```sh
cp values.yaml myvalues.yaml
# edit the values
# THEN:
helm install codepod-dev . -n codepod-dev --values=./myvalues.yaml
helm upgrade codepod-dev . -n codepod-dev --values=./myvalues.yaml
helm uninstall codepod-dev -n codepod-dev
```
