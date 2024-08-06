# CodePod k8s stacks

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
4. install cockroachdb CRD and operator

Follow this: https://www.cockroachlabs.com/docs/stable/deploy-cockroachdb-with-kubernetes#step-2-start-cockroachdb

```sh
kubectl apply -f https://raw.githubusercontent.com/cockroachdb/cockroach-operator/v2.14.0/install/crds.yaml
kubectl apply -f https://raw.githubusercontent.com/cockroachdb/cockroach-operator/v2.14.0/install/operator.yaml
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

## Additional CockroachDB commands

Alter user:

```sh
# connect from cockroach-secure-client without password
cockroach sql \
 --certs-dir=/cockroach/cockroach-certs \
 --host=cockroachdb-public
# alter user
echo "ALTER USER roach WITH PASSWORD '$ROACH_PASSWORD';" | cockroach sql \
 --certs-dir=/cockroach/cockroach-certs \
 --host=cockroachdb-public
# grant admin permission
echo "GRANT admin TO roach;" | cockroach sql \
 --certs-dir=/cockroach/cockroach-certs \
 --host=cockroachdb-public
```

The connection string

```sh
# the connection string
# this doesn't work without CA
psql postgresql://<user>:<password>@cockroachdb-public:26257/bank?sslmode=verify-full
# this works
psql postgresql://<usr>:<password>@cockroachdb-public:26257/bank?sslmode=require
```

Observability: port forward:

```sh
# pg
kubectl port-forward -n codepod-dev svc/database-rw 5432:5432
# cockroachDB
kubectl port-forward svc/cockroachdb-public 26257:26257 -n codepod-dev
# the DB console (dashboard)
kubectl port-forward svc/cockroachdb-public 8080:8080 -n codepod-dev
```

Backups

```sql
BACKUP INTO 's3://path?AWS_ACCESS_KEY_ID=...&AWS_SECRET_ACCESS_KEY=...';
-- show backup
SHOW BACKUPS IN 'external://backup_s3';
-- restore the full cluster
RESTORE FROM LATEST IN '{collectionURI}';
-- restore a database
RESTORE DATABASE bank FROM LATEST IN '{collectionURI}';
-- restore a table
RESTORE TABLE bank.customers FROM LATEST IN '{collectionURI}';
```

Scheduled Backup

```sql
CREATE SCHEDULE core_schedule_label
    FOR BACKUP INTO 's3://...'
    RECURRING '@hourly'
    FULL BACKUP ALWAYS
    WITH SCHEDULE OPTIONS first_run = 'now',
    ignore_existing_backups;
```

The schedules can be viewed in the DB console.

## CockroachDB Migration

Perform migration script on the old PG data.

Export old table data from PostgreSQL:

```sh
psql postgres://postgres:PASSWORD@localhost:5432/app -c\
   "COPY app.public.\"User\" TO stdout DELIMITER ',' CSV;" > User.csv

psql postgres://postgres:PASSWORD@localhost:5432/app -c\
   "COPY app.public.\"Repo\" TO stdout DELIMITER ',' CSV;" > Repo.csv

psql postgres://postgres:PASSWORD@localhost:5432/app -c\
   "COPY app.public.\"UserRepoData\" TO stdout DELIMITER ',' CSV;" > UserRepoData.csv

psql postgres://postgres:PASSWORD@localhost:5432/app -c\
   "COPY app.public.\"_COLLABORATOR\" TO stdout DELIMITER ',' CSV;" > _COLLABORATOR.csv

psql postgres://postgres:PASSWORD@localhost:5432/app -c\
   "COPY app.public.\"_STAR\" TO stdout DELIMITER ',' CSV;" > _STAR.csv
```

Import into the new CockroachDB:

```sql
IMPORT INTO codepod.public."User"
CSV DATA (
   's3://.../User.csv?...'
);
IMPORT INTO codepod.public."Repo"
CSV DATA (
   's3://.../Repo.csv?...'
);
IMPORT INTO codepod.public."UserRepoData"
CSV DATA (
   's3://.../UserRepoData.csv?...'
);
IMPORT INTO codepod.public."_COLLABORATOR"
CSV DATA (
   's3://.../_COLLABORATOR.csv?...'
);
IMPORT INTO codepod.public."_STAR"
CSV DATA (
   's3://.../_STAR.csv?...'
);
```
