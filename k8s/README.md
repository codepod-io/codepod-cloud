# CodePod k8s stacks

## Prepare the cluster

Minimum two nodes:

1. master nodes: no taint or label. This is used to schedule the app.
2. worker nodes: a node with `runtime=true` label and `runtime=true` taint. This
   node is used to schedule kernels.

Then install longhorn.

Then install cnpg.

Continue with one of the following stacks.

## Development Stack

In `charts-dev` folder.

## Production Stack

In `charts-prod` folder.
