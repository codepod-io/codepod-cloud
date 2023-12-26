# Local rancher server with cloudflare tunnel

This stack is used to setup a good k8s on local machine.

Here we assume you have installed docker desktop and enable k8s in its settings.
This is our docker and k8s engine.

Rancher is a good UI to manage k8s. This stack install rancher as a docker container, and create a cloudflare tunnel to connect to it.

Step 1: create a cloudflare tunnel, note down the TOKEN, and add a public host from your domain xxx.yyy.com to http://rancher:80.

Step 2: create a .env file here with the TOKEN in step 1:

```sh
CLOUDFLARE_TUNNEL_TOKEN=xxx
```

Then:

```sh
docker compose up -d
```

Now, you should be visit https://xxx.yyy.com to access rancher.
