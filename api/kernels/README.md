# Start kernel manually for debugging

## Julia

First go into the `julia` folder. All the commands below assume this as current directory.

### Inside the container

Start the container

```
docker compose up -d --build
```

Need to instantiate ZMQ:

```
julia --project /IJulia.jl
]instantiate
```

Then start the kernel:

```
julia -i --color=yes --project=/IJulia.jl /IJulia.jl/src/kernel.jl /conn.json
```

### On host machine

```
julia -i --color=yes --project=./IJulia.jl ./IJulia.jl/src/kernel.jl ./conn.json
```

## Racket

```
racket -l iracket/iracket -- /Users/hebi/Documents/GitHub/codepod/api/kernels/racket/codepod-conn-racket.json
```

Or inside the container

```
racket -l iracket/iracket -- /codepod-conn-racket.json
```

## Inside the container

Racket kernel cannot be installed on recent Mac due to an upstream and OS
restriction, see https://github.com/rmculpepper/racket-zeromq/issues/6.

Thus, I'm using a container.

Inside the container, install iracket for development:

```
cd /iracket
raco pkg install
```

Then start iracket kernel:

```
racket -l iracket/iracket -- /conn.json
```