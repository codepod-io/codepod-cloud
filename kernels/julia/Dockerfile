FROM julia:1.6.2

# psmisc for killall
RUN apt-get update && apt-get install psmisc

# just to install dependencies. I'll use a development version of IJulia
RUN julia -e 'import Pkg; Pkg.add("IJulia")'


# "/root/.julia/packages/IJulia/e8kqU/src/kernel.jl"
RUN KERNEL_PATH=`julia -e 'import IJulia; print(joinpath(dirname(pathof(IJulia)), "kernel.jl"))'` &&\
    echo $KERNEL_PATH &&\
    # FIXME this will cause julia kernel to print warning saying module is not
    # the same (because the path is not the same)
    ln -sf $KERNEL_PATH /kernel.jl

COPY <<EOF /conn.json
{
    "shell_port": 55692,
    "iopub_port": 55693,
    "stdin_port": 55694,
    "control_port": 55695,
    "hb_port": 55696,
    "ip": "0.0.0.0",
    "key": "412d24d7-baca5d46b674d910851edd2f",
    "transport": "tcp",
    "signature_scheme": "hmac-sha256",
    "kernel_name": ""
}
EOF

# ENTRYPOINT ["tail", "-f", "/dev/null"]
# CMD [ "julia", "-i", "--color=yes", "/kernel.jl", "/conn.json"]

COPY <<EOF /run.sh
#!/bin/bash
julia -i --color=yes /kernel.jl /conn.json
EOF

RUN chmod +x /run.sh

CMD ["/run.sh"]