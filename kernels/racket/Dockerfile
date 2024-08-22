FROM racket/racket:8.1-full


# reinstall pict
# RUN raco pkg install --auto --force
# git://github.com/racket/pict/?path=pict-lib

# RUN raco pkg install --auto iracket
# RUN raco iracket install
#
# install build deps so that I'll just run local install everytime a new
# contianer is created
RUN raco pkg install --auto zeromq-r-lib uuid sha
RUN raco pkg install iracket

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

# RUN raco pkg install --auto https://github.com/bhdl/bhdl.git?path=src
# RUN apt update && apt install -y git procps

# FIXME I need to map the ports
# CMD ["racket", "-l", "iracket/iracket", "--", "/codepod-conn-racket.json"]
# CMD ["bash"]
# ENTRYPOINT ["tail", "-f", "/dev/null"]

# Need to add -t flag to escape sandbox. Otherwise, (system "ls") won't work,
# throwing an error:
# > subprocess: `execute' access denied for /bin/sh
#
# Ref: https://github.com/rmculpepper/iracket/issues/13#issuecomment-880958818
# CMD ["racket", "-l", "iracket/iracket", "--", "-t", "/conn.json"]
CMD ["sh", "-c", "racket -l iracket/iracket -- -t /conn.json"]