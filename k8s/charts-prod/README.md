# CodePod Helm chart

This helm chart is used for development.

1. It uses local docker images.
2. It mounts the host src dir into the k8s pods, so that the app is hot-reloaded
   when the src files change.

# Deploy

## Install regcred for pulling private registry

1.  first `docker login`, which generates `~/.docker/config.json` file.
2.  add regcred secret from the above creds file

```sh
kubectl create secret generic regcred -n codepod-staging \
    --from-file=.dockerconfigjson=./.values/config.json \
    --type=kubernetes.io/dockerconfigjson
```

## fill in the values.yaml

1. google client ID
2. cloudflare tunnel token
3. generate random tokens for jwtSecret and roachPassword

verify other values:

1. app chart version
2. kernel version

## Install the app

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
