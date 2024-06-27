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
kubectl create ns codepod-staging
kubectl create ns codepod-staging-runtime
# to cleanup run:
# kubectl delete ns codepod-staging
```

Create docker regcred:

1. first `docker login`, which generates `~/.docker/config.json` file.
2. add regcred secret from the above creds file

```sh
kubectl create secret generic regcred -n codepod-staging \
    --from-file=.dockerconfigjson=/home/hebi/.docker/config.json \
    --type=kubernetes.io/dockerconfigjson
```

edit configuration values and perform helm install:

```sh
mkdir .values
cp values.yaml .values/staging.yaml
# edit the values
# ...
```

The `values.yaml` file:

```yaml
jwtSecret:
googleClientId:
dbPassword:
awsAccessKeyId:
awsSecretAccessKey:
```

```sh
# THEN:
helm install codepod . -n codepod-staging --values=./.values/staging.yaml
helm upgrade codepod . -n codepod-staging --values=./.values/staging.yaml
helm uninstall codepod -n codepod-staging
```

# First time DB setup

Change api pod's startup command to `tail -f /dev/null`, then run `pnpm dlx prisma migrate deploy` in the pod to apply the change, then change back the command.
