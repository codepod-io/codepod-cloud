FROM node:16

RUN npm install -g ijavascript

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

CMD ["ijskernel", "--hide-undefined", "/conn.json", "--protocol=5.1"]