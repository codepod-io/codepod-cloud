# CodePod: coding on a canvas, organized.

Codepod provides the interactive coding experience popularized by Jupyter, but
with scalability and production-readiness. Users can still incrementally build
up code by trying out a small code snippet each time. But they would not be
overwhelmed by the great number of code snippets as the projects grow.

<div align="center"><h3><a href="https://codepod.io" target="_blank"> homepage</a> | 
  <a href="https://codepod.io/docs/manual/" target="_blank">manual</a> |
  <a href="https://app.codepod.io" target="_blank">try online</a>
</h3>  <a href="https://discord.gg/W4B4gQdZZS"><img src="https://dcbadge.vercel.app/api/server/W4B4gQdZZS?style=flat" /></a>
 </div>

![screenshot](./screenshot-canvas.png)

# Gallery

Thanks to our community, we now have CodePod showcases ranging from analytical geometry to bioinformatics.

- [plotting common functions](https://app.codepod.io/repo/2ncnioylo9abo3otdxjs)
- [image operations using skimage](https://user-images.githubusercontent.com/44469195/239033643-decbd7ae-29bb-44b9-af33-d4cb7c2bce46.png)
- [tel-siRNA sequence detector](https://app.codepod.io/repo/b94n7n00a9395xwhv1o8)

# Dev

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

> cd ui
> pnpm dev
# Local:   http://localhost:3000/
```

## The .env files

compose/db/.env

```
POSTGRES_USER=myuser
POSTGRES_PASSWORD=mypassword
POSTGRES_DB=codepod
```

api/.env

```
JWT_SECRET=mysecret
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/codepod?schema=public"
GOOGLE_CLIENT_ID=...
```

ui/.env

```
VITE_APP_GOOGLE_CLIENT_ID=...
VITE_APP_YJS_WS_URL="ws://localhost:4233/socket"
VITE_APP_API_URL="http://localhost:4000/graphql"
```

# Contributing

CodePod is open-source under an MIT license. Feel free to contribute to make
it better together with us. You can contribute by [creating awesome showcases](#gallery),
[reporting a bug, suggesting a feature](https://github.com/codepod-io/codepod/issues),
or submitting a pull request.
Do use [Prettier](https://prettier.io/) (e.g., [its VSCode
plugin](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode))
to format your code before checking in.
Last but not least, give us a star on Github!

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
