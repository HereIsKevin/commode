FROM almalinux:8 AS build
ARG node_version

# Install dependencies.
RUN dnf install --assumeyes gcc-toolset-15 make python3.12

# Copy context to container.
WORKDIR /root/
COPY ./ ./

# Build Node.js binary.
WORKDIR /root/node-$node_version/
RUN source /opt/rh/gcc-toolset-15/enable && \
    ./configure --enable-lto --without-intl --without-amaro --without-npm --without-node-options --without-inspector && \
    make -j4 && \
    strip ./out/Release/node

# Copy Node.js binary to blank stage for export.
FROM scratch
ARG node_version
COPY --from=build /root/node-$node_version/out/Release/node /
