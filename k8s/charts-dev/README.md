# CodePod Helm chart v2

This helm chart is used for development.

1. It uses local docker images.
2. It mounts the host src dir into the k8s pods, so that the app is hot-reloaded
   when the src files change.

# Prepare

Install Docker desktop and enable k8s in settings.

Clone the codepod-cloud repository, into path `/path/to/codepod-cloud`.

# Deploy

create namespace

```sh
kubectl create ns codepod-dev
kubectl create ns codepod-dev-runtime
```

edit configuration values and perform helm install:

```sh
# create a copy of values.yaml
mkdir .values
cp values.yaml .values/dev.yaml
# edit the values
# ...
```

The values:

```yaml
srcDir: "/path/to/codepod-cloud"
# you will also need to set the allowed origins in GCP console for this clientId.
googleClientId:
```

```sh
# THEN:
helm install codepod . -n codepod-dev --values=./.values/dev.yaml
helm upgrade codepod . -n codepod-dev --values=./.values/dev.yaml
helm uninstall codepod -n codepod-dev
```

# First time pnpm package install

Open a terminal in the `codepod-init` pod and run:

```sh
corepack enable && pnpm i
```

# First time DB setup

~~Change api pod's startup command to `tail -f /dev/null`, then run `pnpm dlx prisma migrate dev` in the pod to apply the change, then change back the command.~~

Open a terminal in the `api` pod and run `pnpm dlx prisma db push` to sync the schema with DB.

Here are the commands to work with Prisma schema:

- During development, use `prisma db push`;
- When commiting the schema changes to git, use `prisma migrate dev --name SOME_NAME`;
- For deployment, use `prisma migrate deploy`.

# CockroachDB setup

Step 1: manually create a user.

```sh
# connect from cockroach-secure-client without password
cockroach sql \
 --certs-dir=/cockroach/cockroach-certs \
 --host=cockroachdb-public
# create user
echo "CREATE USER roach WITH PASSWORD '$ROACH_PASSWORD';" | cockroach sql \
 --certs-dir=/cockroach/cockroach-certs \
 --host=cockroachdb-public
# alter user
echo "ALTER USER roach WITH PASSWORD '$ROACH_PASSWORD';" | cockroach sql \
 --certs-dir=/cockroach/cockroach-certs \
 --host=cockroachdb-public
```

Step 2: the connection string

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

# Migration

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
