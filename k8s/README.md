# CodePod k8s stacks

Observability

- k8s dashboard
- k9s
- longhorn dashboard
- prisma dashboard
- cockroachdb console
- grafana

## Prepare the cluster

First, install a rancher for privisioning clusters:

1. install k3s
2. install rancher

Next, use rancher to privision the cluster:

1. create master VMs and runtime VMs. **Install open-iscsi on master VMs otherwise longhorn will not work.**
   1. master nodes: no taint or label. This is used to schedule the app.
   2. worker nodes: a node with `runtime=true` label and `runtime=true` taint.
      This node is used to schedule kernels.
2. provision k3s from rancher, set taint and label for runtime nodes
3. install longhorn in the VM
4. install CNPG operator

## Update v2: use rancher to provision

1. run rancher-on-docker on a separate VM
2. set server-url to local-network-ip
3. create cluster, select k3s and deselect traefik
   - master:
     - select all roles
     - set public IP and private IP
   - runtime:
     - set public IP and private IP
     - select worker role only
     - set runtime=true label and taint
4. install nginx ingress

```sh
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace
```

5. install longhorn

```sh
helm repo add longhorn https://charts.longhorn.io
helm repo update
helm install longhorn longhorn/longhorn --namespace longhorn-system --create-namespace --version 1.7.1
kubectl -n longhorn-system get pod
```

6. install CNPG operator chart

```sh
helm repo add cnpg https://cloudnative-pg.github.io/charts
helm upgrade --install cnpg \
  --namespace cnpg-system \
  --create-namespace \
  cnpg/cloudnative-pg
```

## Update: use k3s on baremetal without rancher provisioning

```sh
# curl -sfL https://get.k3s.io | sh -
# token generation
openssl rand -hex 12

# First server
curl -sfL https://get.k3s.io |  INSTALL_K3S_VERSION=v1.30.4+k3s1 sh -s - server --cluster-init --disable=traefik --node-ip 10.0.0.x --node-external-ip 5.x.x.x

# This is the auto-generated token
cat /var/lib/rancher/k3s/server/token
# This is the kubeconfig
cat /etc/rancher/k3s/k3s.yaml

curl -sfL https://get.k3s.io | sh -s - server --cluster-init --disable=traefik

# other servers
curl -sfL https://get.k3s.io | K3S_TOKEN=SECRET sh -s - server --disable=traefik \
    --server https://x.x.x.x:6443

# workers
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=v1.30.4+k3s1 sh -s - agent \
    --server https://10.0.0.x:6443 \
    --node-ip 10.0.0.x --node-external-ip 5.x.x.x \
    --token xxx \
    --node-label runtime=true \
    --node-taint runtime=true:NoSchedule

```

Optional: If k3s is already installed with traefik (ref: https://qdnqn.com/k3s-remove-traefik/):

```sh
sudo rm -rf /var/lib/rancher/k3s/server/manifests/traefik.yaml
helm uninstall traefik traefik-crd -n kube-system
sudo systemctl restart k3s
```

Add label and taint

```sh
kubectl label nodes k3s-runtime-01 runtime=true
# verify: kubectl label --list nodes k3s-runtime-01
kubectl taint nodes k3s-runtime-01 runtime=true:NoSchedule

# Before:
# k3s-01           Ready    control-plane,etcd,master   37m   v1.30.3+k3s1
# k3s-runtime-01   Ready    <none>                      36m   v1.30.3+k3s1
kubectl label nodes k3s-01 node-role.kubernetes.io/worker=worker
kubectl label nodes k3s-runtime-01 node-role.kubernetes.io/worker=worker
# verify
kubectl get no
# After
# k3s-01           Ready    control-plane,etcd,master,worker   37m   v1.30.3+k3s1
# k3s-runtime-01   Ready    worker                             36m   v1.30.3+k3s1
```

Install longhorn

```sh
helm repo add longhorn https://charts.longhorn.io
helm repo update
helm install longhorn longhorn/longhorn --namespace longhorn-system --create-namespace --version 1.6.2
kubectl -n longhorn-system get pod
```

Install nginx ingress controller

```sh
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace
# set as default ingress?
```

## Note about installing longhorn on k3s

Need to install open-iscsi. Reference: https://github.com/longhorn/longhorn/issues/7139#issuecomment-1819684668

To uninstall (broken) longhorn:

```sh
apiVersion: longhorn.io/v1beta2
kind: Setting
metadata:
   name: deleting-confirmation-flag
   namespace: longhorn-system
value: "true"
```

then go to installed apps, select all namespaces, and delete longhorn first, then longhorn-crds.

There could be more problems uninstalling longhorn. Refs:

- https://github.com/longhorn/longhorn/issues/6470
- https://longhorn.io/docs/1.5.3/deploy/uninstall/

## Development Stack

In `charts-dev` folder.

## Production Stack

In `charts-prod` folder.

# Additional Notes

## About first time DB setup

Open a terminal in the `api` pod and run `pnpm dlx prisma db push` to sync the schema with DB.

Here are the commands to work with Prisma schema:

- During development, use `prisma db push`;
- When commiting the schema changes to git, use `prisma migrate dev --name SOME_NAME`;
- For deployment, use `prisma migrate deploy`.

## ulimit problem

Error: failed to create fsnotify watcher: too many open files

Fixing the too many files opened problem:

- This github reply points out the problem: https://github.com/derailed/k9s/issues/1399#issuecomment-1512001429
- The ulimit -n isn't the issue, the fs.inotify.max_user_instances is. It was 128 on my node.
  - Follow this page to set it. https://www.suse.com/support/kb/doc/?id=000020048

```sh
cat /proc/sys/fs/inotify/max_user_instances
cat /proc/sys/fs/inotify/max_user_watches
sudo sysctl fs.inotify.max_user_instances=8192
sudo sysctl fs.inotify.max_user_watches=524288
sudo sysctl -p
```

This should be run on the host of k8s nodes.
