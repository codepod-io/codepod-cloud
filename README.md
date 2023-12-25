# CodePod: coding on a canvas, organized.

Codepod provides the interactive coding experience popularized by Jupyter, but
with scalability and production-readiness. Users can still incrementally build
up code by trying out a small code snippet each time. But they would not be
overwhelmed by the great number of code snippets as the projects grow. Learn
more on our website at https://codepod.io.

![screenshot](./screenshot-canvas.png)

# (NEW) Develop with docker

Without docker, we need to manually launch 5 processes and there're many `.env`
files to coordinate ports and variables among the processes. This is tedious.

Previously we moved away from docker because:

1. pnpm store seems incompatible with docker & host
2. hot-reloading is sometimes not working.

It turns out that (1) can be solved by building a docker image w/ `pnpm i`, and
mounting only src folders. (2) is/was not that bad. So we move back to docker.

## Step 1: Build docker images

Build the docker images `codepod-cloud` and `codepod-cloud-runtime`:

```sh
docker build -t codepod-cloud .
docker build -t codepod-cloud-runtime -f Dockerfile.runtime .
```

## Step 2: Run the app

Add one single .env file at `compose/web2/.env`:

```sh
# COMPOSE_PROJECT_NAME=mystackname

# DB
POSTGRES_USER=myuser
POSTGRES_PASSWORD=mypassword
POSTGRES_DB=codepod

# API
JWT_SECRET=mysecret
GOOGLE_CLIENT_ID=
```

Inside `compose/web2`, run

```sh
docker compose up -d
```

(Setup once) If the DB is not initialized, attach a shell in `api` container and run DB init:

```sh
npx prisma migrate dev
```

Go to `http://localhost:8080` to see the app.

## Step 3: (Optional) copilot server

Copilot is not performant inside docker contianer (on an Apple Sillicon Mac,
compared to host machine w/ Metal). We launch the copilot server on the host and
let the docker stack proxy the request to the host machine.

Add a config file `api/.env`:

```sh
LLAMA_CPP_SERVER=127.0.0.1
LLAMA_CPP_PORT=8080

MODEL_DIR="/path/to/models"
MODEL_NAME="codellama-7b.Q4_0.gguf"
CONTEXT_SIZE=2048
THREADS=6

N_PREDICT=128
TEMPERATURE=0.1
TOP_K=40
TOP_P=0.9
REPEAT_PENALTY=1.05
```

Launch the copilot server at http://localhost:4333:

```sh
cd api
pnpm dev:copilot
```

# (Deprecated) Develop natively on the host

## The .env files

compose/db/.env

```sh
POSTGRES_USER=myuser
POSTGRES_PASSWORD=mypassword
POSTGRES_DB=codepod
```

api/.env

```sh
JWT_SECRET=mysecret
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/codepod?schema=public"
GOOGLE_CLIENT_ID=...

YJS_WS_URL=ws://localhost:4233/socket

LLAMA_CPP_SERVER=127.0.0.1
LLAMA_CPP_PORT=8080
```

ui/.env

```sh
VITE_APP_GOOGLE_CLIENT_ID=...

VITE_APP_YJS_WS_URL="ws://localhost:4233/socket"
VITE_APP_API_URL="http://localhost:4000/trpc"
VITE_APP_RUNTIME_API_URL="http://localhost:4001/trpc"
VITE_APP_COPILOT_API_URL="http://localhost:4333/trpc"
```

## (optional) Start copilot server

compile and start the llama.cpp server

```sh
cd llama.cpp
cmake .
make -j
./server -m /path/to/codellama-7b.Q4_0.gguf -c 2048
```

This will setup the REST API listening on http://localhost:8080

## Start the database in a docker container

Start the DB container:

```sh
cd compose/db
docker compose up -d
```

If it's the first time you setup the DB, you need to initialize the DB with the tables:

```sh
cd api
pnpm dlx prisma migrate dev
```

## Start the app

Start the servers:

```sh
cd api
pnpm dev:main
# 🚀 Server ready at http://localhost:4000
pnpm dev:yjs
# 🚀 Server ready at http://localhost:4233
pnpm dev:runtime
# 🚀 Server ready at http://localhost:4001
pnpm dev:copilot
# 🚀 Server ready at http://localhost:4333
```

Start the web UI

```sh
cd ui
pnpm dev
# Local:   http://localhost:3000/
```

# Citation

https://arxiv.org/abs/2301.02410

```
@misc{https://doi.org/10.48550/arxiv.2301.02410,
  doi = {10.48550/ARXIV.2301.02410},
  url = {https://arxiv.org/abs/2301.02410},
  author = {Li, Hebi and Bao, Forrest Sheng and Xiao, Qi and Tian, Jin},
  title = {Codepod: A Namespace-Aware, Hierarchical Jupyter for Interactive Development at Scale},
  publisher = {arXiv},
  year = {2023},
  copyright = {Creative Commons Attribution 4.0 International}
}
```
