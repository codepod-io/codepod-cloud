FROM python:3.9-buster

RUN pip install ipykernel

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


# For development:
# python3 -m ipykernel_launcher -f ./conn.json
CMD ["python3", "-m", "ipykernel_launcher", "-f", "/conn.json"]
# ENTRYPOINT ["tail", "-f", "/dev/null"]