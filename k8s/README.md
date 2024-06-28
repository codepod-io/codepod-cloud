# CodePod k8s stacks

Minimum two nodes:

1. no taint or label. This is used to schedule the app.
2. a node with `runtime=true` label and `runtime=true` taint. This node is used to schedule kernels.

## Development Stack

In `charts` folder.

## Production Stack

In `charts-prod` folder.
