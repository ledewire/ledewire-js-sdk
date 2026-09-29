# Keep the Node major in step with .nvmrc.
FROM node:20-bookworm

# pnpm comes from corepack, pinned to package.json's packageManager. COREPACK_HOME is
# moved out of root's home so the unprivileged `node` user can run the shim.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    COREPACK_HOME=/usr/local/share/corepack
RUN corepack enable \
 && corepack prepare pnpm@9.15.0 --activate \
 && chmod -R a+rX "$COREPACK_HOME"

USER node
ENV npm_config_store_dir=/home/node/.pnpm-store

# Fill the pnpm store from the lockfile alone, so a fresh worktree's
# `pnpm install --offline` links from the image instead of hitting the registry.
# The layer is keyed on pnpm-lock.yaml (plus the two config files pnpm reads with
# it), so every worktree whose lockfile matches one already built reuses it.
# .dockerignore narrows the build context to just these files.
COPY --chown=node:node pnpm-lock.yaml pnpm-workspace.yaml .npmrc /home/node/deps/
# --ignore-scripts: lifecycle scripts belong to `pnpm install` in the container, where
# the workspace they expect exists; here there is no package.json for them to find.
RUN cd /home/node/deps && pnpm fetch --ignore-scripts
