# CodePod Helm chart

This helm chart is used for development.

1. It uses local docker images.
2. It mounts the host src dir into the k8s pods, so that the app is hot-reloaded
   when the src files change.

# Use rancher-for-cloud

## Deploy

1. deploy rancher on k8s with self-signed cert.
2. deploy cloudflare tunnel set to https://<the-ip-address-192.168.x.x>:443 (must use full IP) with tls verify set to false.

Now it is possible to access the rancher server from the public cloud VMs.

## Use

Since I have a tunnel in front of rancher, I need to skip tls verification for
rancher's self-generated cert. Add `insecure-skip-tls-verify: true` to the k8s
yaml file. Ref: https://stackoverflow.com/a/48131508

Otherwise, I have to specify `--insecure-skip-tls-verify` for every kubectl, and this flag doesn't work for helm.

This is still secure because everything is inside cloudflare tunnel.

# Deploy

## Prepare files

prepare these files:

- .values/XXX-codepod-io/
  - values.yaml: fill in the values
  - kubeconfig.yaml: the cluster connection file
  - README.md: copy and rename XXX to the dns name for easy copying

fill in the values.yaml

1. google client ID
2. generate random tokens for jwtSecret and roachPassword

verify other values:

1. app chart version
2. kernel version

setup cluster kubeconfig

```sh
export KUBECONFIG=.values/XXX-codepod-io/kubeconfig.yaml
```

## Cluster prepare

1. Make sure the cluster has runtime node with taint and label.
2. install open-iscsi, install longhorn
3. Create cloudflare tunnel and install on the cluster nodes. Point
   XXX.codepod.io to localhost:80
4. Install nginx ingress controller
   (https://kubernetes.github.io/ingress-nginx/deploy/#quick-start). If you have
   traefik installed, need to install it first, because it will occupy the port.

```sh
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace
```

Install cockroachdb CRDs and operator:

```sh
kubectl apply -f https://raw.githubusercontent.com/cockroachdb/cockroach-operator/v2.14.0/install/crds.yaml
kubectl apply -f https://raw.githubusercontent.com/cockroachdb/cockroach-operator/v2.14.0/install/operator.yaml
```

## Install the app

1. create namespaces

```sh
kubectl create ns XXX-codepod-io
kubectl create ns XXX-codepod-io-runtime
# to cleanup run:
# kubectl delete ns XXX-codepod-io
```

2. Install regcred for pulling private registry
   1. first `docker login`, which generates `~/.docker/config.json` file.
   2. add regcred secret from the above creds file

```sh
kubectl create secret generic regcred -n XXX-codepod-io \
    --from-file=.dockerconfigjson=./.values/config.json \
    --type=kubernetes.io/dockerconfigjson
```

3. run helm install

edit configuration values and perform helm install:

```sh
mkdir .values
cp values.yaml .values/XXX-codepod-io/values.yaml
# edit the values
# ...
# THEN:
helm install codepod . -n codepod-staging --values=./.values/XXX-codepod-io/values.yaml
helm upgrade codepod . -n codepod-staging --values=./.values/XXX-codepod-io/values.yaml
helm uninstall codepod -n codepod-staging
# or to install/upgrade wth one command

helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace
```

4. create cockroachdb user

```sh
# create user
echo "CREATE USER roach WITH PASSWORD '$ROACH_PASSWORD'; GRANT admin TO roach;" | cockroach sql \
 --certs-dir=/cockroach/cockroach-certs \
 --host=cockroachdb-public
```

5. prisma migrate deploy

# Maintainence

1. Update version in Chart.yaml, and upgrate the app with helm.
2. When DB schema changed, run prisma migrate deploy.
3. DB backups.
4. (deep) infra upgrade:
   1. backup the data
   2. redirect DNS to readonly instances
   3. flush yjs cache
   4. update the infra
   5. redeploy app
   6. restore DB
   7. redirect DNS back
