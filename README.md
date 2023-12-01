# CodePod: coding on a canvas, organized.

Codepod provides the interactive coding experience popularized by Jupyter, but
with scalability and production-readiness. Users can still incrementally build
up code by trying out a small code snippet each time. But they would not be
overwhelmed by the great number of code snippets as the projects grow. Learn
more on our website at https://codepod.io.

![screenshot](./screenshot-canvas.png)

# Develop

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
```

copilot/.env

```sh
LLAMA_CPP_SERVER=127.0.0.1
LLAMA_CPP_PORT=8080
```

ui/.env

```sh
VITE_APP_GOOGLE_CLIENT_ID=...
VITE_APP_YJS_WS_URL="ws://localhost:4233/socket"
VITE_APP_API_URL="http://localhost:4000/graphql"
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

## Start the app stack

Step 1: start the DB

```
> cd compose/db
> docker compose up -d
> cd packages/prisma
> npx prisma migrate dev
```

Step 2: Start the app:

```
> cd api
> pnpm dev
# 🚀 Server ready at http://localhost:4000

> cd api
> pnpm dev:yjs
# 🚀 Server ready at http://localhost:4233

> cd container
> pnpm dev
# 🚀 Server ready at http://localhost:4001

# optional: copilot
> cd copilot
> pnpm dev
# 🚀 Server ready at http://localhost:4333

> cd ui
> pnpm dev
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
