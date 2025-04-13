FROM golang:1.24.1

# Add NodeJS for frontend development
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get update \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Add user
ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID

# Create the user
RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME \
    && apt-get update \
    && apt-get install -y sudo \
    && echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

# Set up workspace
WORKDIR /workspace

# Set the desired timezone environment variable
ENV TZ=America/New_York

# Install Go tools
RUN apt-get update && apt-get -y install git \
    && GO111MODULE=on go install golang.org/x/tools/gopls@latest \
    && GO111MODULE=on go install github.com/go-delve/delve/cmd/dlv@latest \
    && GO111MODULE=on go install honnef.co/go/tools/cmd/staticcheck@latest

# Install PostgreSQL client
RUN apt-get update && apt-get install -y postgresql-client

# Set up Go environment
ENV GOPATH=/go
ENV PATH=$GOPATH/bin:/usr/local/go/bin:$PATH

# Copy certs
COPY certs/ /app/certs/

# Fix permissions for Go directories
RUN mkdir -p /go/pkg/mod && chown -R vscode:vscode /go
# Create the /app directory and set proper permissions
RUN mkdir -p /app && chown -R vscode:vscode /app

# Switch to non-root user
USER $USERNAME