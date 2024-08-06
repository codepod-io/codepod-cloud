# CodePod Helm chart v2

This helm chart is used for development.

1. It uses local docker images.
2. It mounts the host src dir into the k8s pods, so that the app is hot-reloaded
   when the src files change.

# Prepare

Install Docker desktop and enable k8s in settings.

# Step 1: install cluster and CRDs

First, install a rancher for privisioning clusters:

1. install k3s
2. install rancher

Next, use rancher to privision the cluster:

1. create master VMs and runtime VMs. Install open-iscsi on master VMs
2. provision k3s from rancher, set taint and label for runtime nodes
3. install longhorn in the VM
4. install cockroachdb CRD and operator

Follow this: https://www.cockroachlabs.com/docs/stable/deploy-cockroachdb-with-kubernetes

```sh
kubectl apply -f https://raw.githubusercontent.com/cockroachdb/cockroach-operator/v2.14.0/install/crds.yaml
kubectl apply -f https://raw.githubusercontent.com/cockroachdb/cockroach-operator/v2.14.0/install/operator.yaml
```

5. install regcred for pulling private registry
   1. first `docker login`, which generates `~/.docker/config.json` file.
   2. add regcred secret from the above creds file

```sh
kubectl create secret generic regcred -n codepod-staging \
    --from-file=.dockerconfigjson=./.values/config.json \
    --type=kubernetes.io/dockerconfigjson
```

# Step 2: install the app

fill in the values

1. google client ID
2. cloudflare tunnel token
3. generate random tokens for jwtSecret and roachPassword

verify other values:

1. app chart version
2. kernel version

Install the app:

1. create namespaces

```sh
kubectl create ns codepod-staging
kubectl create ns codepod-staging-runtime
# to cleanup run:
# kubectl delete ns codepod-staging
```

2. run helm install

edit configuration values and perform helm install:

```sh
mkdir .values
cp values.yaml .values/staging.yaml
# edit the values
# ...
# THEN:
helm install codepod . -n codepod-staging --values=./.values/staging.yaml
helm upgrade codepod . -n codepod-staging --values=./.values/staging.yaml
helm uninstall codepod -n codepod-staging
```

3. create cockroachdb user

```sh
# create user
echo "CREATE USER roach WITH PASSWORD '$ROACH_PASSWORD'; GRANT admin TO roach;" | cockroach sql \
 --certs-dir=/cockroach/cockroach-certs \
 --host=cockroachdb-public
```

4. prisma migrate deploy
5. configure cloudflare tunnel in the web console as follows:

staging-local.codepod.io/api
http://codepod-api-service:4000

staging-local.codepod.io/yjs
http://codepod-yjs-service:4233

staging-local.codepod.io/runtime
http://codepod-runtime-service:4001

staging-local.codepod.io/
http://codepod-ui-service:80

# Additional notes

Observability of cockroachdb dashboard:

```sh
# pg
kubectl port-forward -n codepod-dev svc/database-rw 5432:5432
# cockroachDB
kubectl port-forward svc/cockroachdb-public 26257:26257 -n codepod-dev
# the DB console (dashboard)
kubectl port-forward svc/cockroachdb-public 8080:8080 -n codepod-dev
```
