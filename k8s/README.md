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

## Update: use k3s on baremetal without rancher provisioning

```sh
# curl -sfL https://get.k3s.io | sh -
# token generation
openssl rand -hex 12

# First server
curl -sfL https://get.k3s.io | K3S_TOKEN=SECRET sh -s - server --cluster-init --disable=traefik

# other servers
curl -sfL https://get.k3s.io | K3S_TOKEN=SECRET sh -s - server --disable=traefik \
    --server https://<ip or hostname of server1>:6443

# workers
curl -sfL https://get.k3s.io | K3S_TOKEN=SECRET sh -s - agent \
    --server https://<ip or hostname of server>:6443 \
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
