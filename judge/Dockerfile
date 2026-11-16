# Build from the repository root:
# docker build -f judge/Dockerfile -t yato/judge .

ARG DEBIAN_IMAGE=docker.io/library/debian:trixie
FROM ${DEBIAN_IMAGE} AS base
RUN sed -i 's|http://deb.debian.org/debian$|http://opensource.nchc.org.tw/debian|' \
      /etc/apt/sources.list.d/debian.sources \
    && echo 'Acquire::Retries "5";' > /etc/apt/apt.conf.d/80-retries

FROM base AS build
RUN apt update && DEBIAN_FRONTEND=noninteractive apt install -y -q --no-install-recommends \
      ca-certificates cmake g++ make git pkg-config libssl-dev \
      bison flex protobuf-compiler libprotobuf-dev libnl-route-3-dev
COPY judge/scripts/install-nsjail.sh /tmp/install-nsjail.sh
RUN --mount=type=secret,id=ca \
    if [ -s /run/secrets/ca ]; then cp /run/secrets/ca /usr/local/share/ca-certificates/build-ca.crt && update-ca-certificates; fi && \
    PREFIX=/opt/nsjail /tmp/install-nsjail.sh
WORKDIR /src
COPY judge/CMakeLists.txt judge/
COPY judge/src judge/src
COPY judge/tests judge/tests
RUN cmake -S judge -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j"$(nproc)"

FROM base AS exec
# On Debian 13: GCC 14, Clang 19 with libc++, Python 3.13.
RUN apt update && DEBIAN_FRONTEND=noninteractive apt install -y -q --no-install-recommends \
      gcc g++ libc6-dev clang libc++-dev libc++abi-dev python3 \
      libprotobuf32t64 libnl-route-3-200 libssl3t64 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /opt/nsjail/bin/nsjail /usr/local/bin/nsjail
COPY --from=build /src/build/yato-judge /usr/local/bin/yato-judge
COPY --from=build /src/build/judge_tests /usr/local/bin/judge-selftest
ENV YATO_API_URL=http://api:3001
VOLUME /var/lib/yato-judge
CMD ["yato-judge"]
