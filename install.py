#!/usr/bin/env python3
"""
AffMine Dashboard — Docker Installer Script

Deploys the AffMine Dashboard, API Server, and PostgreSQL database
locally via Docker with minimal effort. Supports Windows, macOS, and Linux.

Usage:
    python install.py            # Build and start all services
    python install.py --stop     # Stop all running containers
    python install.py --status   # Show status of running containers
"""

import os
import platform
import shutil
import socket
import subprocess
import sys
import textwrap

PROJECT_NAME = "affmine"
DEFAULT_PORTS = {"dashboard": 3000, "api": 5000, "postgres": 5432}
MAX_PORT_SCAN = 100


def detect_os():
    system = platform.system().lower()
    if system == "windows":
        return "windows"
    elif system == "darwin":
        return "macos"
    else:
        return "linux"


def print_banner():
    print()
    print("=" * 60)
    print("       AffMine Dashboard — Docker Installer")
    print("=" * 60)
    print()


def print_os_info(detected_os):
    os_names = {"windows": "Windows", "macos": "macOS", "linux": "Linux"}
    print(f"  Detected OS: {os_names.get(detected_os, detected_os)}")
    print(f"  Python:      {platform.python_version()}")
    print()


def run_cmd(cmd, capture=True, check=False):
    try:
        kwargs = dict(
            stdout=subprocess.PIPE if capture else None,
            stderr=subprocess.PIPE if capture else None,
            universal_newlines=True,
            check=check,
            shell=isinstance(cmd, str),
        )
        result = subprocess.run(cmd, **kwargs)
        return result
    except FileNotFoundError:
        return None
    except subprocess.CalledProcessError:
        return None


def find_docker_compose_cmd():
    result = run_cmd(["docker", "compose", "version"])
    if result and result.returncode == 0:
        return ["docker", "compose"]
    result = run_cmd(["docker-compose", "--version"])
    if result and result.returncode == 0:
        return ["docker-compose"]
    return None


def check_docker(detected_os):
    print("[1/5] Checking Docker installation...")
    docker_path = shutil.which("docker")
    if not docker_path:
        print()
        print("  ERROR: Docker is not installed or not in PATH.")
        print()
        if detected_os == "windows":
            print("  Install Docker Desktop for Windows:")
            print("    https://docs.docker.com/desktop/install/windows-install/")
            print()
            print("  After installing, restart your terminal and run this script again.")
        elif detected_os == "macos":
            print("  Install Docker Desktop for macOS:")
            print("    https://docs.docker.com/desktop/install/mac-install/")
            print()
            print("  Or install via Homebrew:")
            print("    brew install --cask docker")
        else:
            print("  Install Docker on Linux:")
            print("    sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin")
            print()
            print("  Then add your user to the docker group:")
            print("    sudo usermod -aG docker $USER")
            print("    (log out and back in for this to take effect)")
        print()
        sys.exit(1)
    print(f"  Docker found: {docker_path}")

    compose_cmd = find_docker_compose_cmd()
    if not compose_cmd:
        print()
        print("  ERROR: Docker Compose is not available.")
        print()
        if detected_os == "windows" or detected_os == "macos":
            print("  Docker Compose is included with Docker Desktop.")
            print("  Please ensure Docker Desktop is up to date.")
        else:
            print("  Install Docker Compose plugin:")
            print("    sudo apt-get install -y docker-compose-plugin")
        print()
        sys.exit(1)
    print(f"  Docker Compose found: {' '.join(compose_cmd)}")

    result = run_cmd(["docker", "info"])
    if result is None or result.returncode != 0:
        print()
        print("  ERROR: Docker daemon is not running.")
        print()
        if detected_os == "windows" or detected_os == "macos":
            print("  Please start Docker Desktop and wait for it to be ready.")
        else:
            print("  Start the Docker daemon:")
            print("    sudo systemctl start docker")
            print()
            print("  To enable Docker on boot:")
            print("    sudo systemctl enable docker")
        print()
        sys.exit(1)
    print("  Docker daemon is running.")
    print()
    return compose_cmd


def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        try:
            s.connect(("127.0.0.1", port))
            return True
        except (ConnectionRefusedError, OSError):
            return False


def get_docker_used_ports():
    used = set()
    result = run_cmd(["docker", "ps", "--format", "{{.Ports}}"])
    if result and result.returncode == 0 and result.stdout.strip():
        for line in result.stdout.strip().split("\n"):
            for part in line.split(","):
                part = part.strip()
                if "->" in part:
                    host_part = part.split("->")[0]
                    if ":" in host_part:
                        port_str = host_part.rsplit(":", 1)[-1]
                        try:
                            used.add(int(port_str))
                        except ValueError:
                            pass
    return used


def find_available_port(start_port, docker_ports):
    port = start_port
    for _ in range(MAX_PORT_SCAN):
        if port not in docker_ports and not is_port_in_use(port):
            return port
        port += 1
    print(f"  ERROR: Could not find an available port starting from {start_port}")
    sys.exit(1)


def scan_ports():
    print("[2/5] Scanning for available ports...")
    docker_ports = get_docker_used_ports()
    ports = {}
    for service, default in DEFAULT_PORTS.items():
        port = find_available_port(default, docker_ports)
        ports[service] = port
        status = "" if port == default else f" (default {default} was in use)"
        print(f"  {service:>10}: {port}{status}")
    print()
    return ports


def prompt_credentials():
    print("[3/5] Enter your AffMine credentials")
    print()

    aff_id = ""
    while not aff_id.strip():
        aff_id = input("  AffMine aff_id: ").strip()
        if not aff_id:
            print("  Error: aff_id cannot be empty. Please try again.")

    api_key = ""
    while not api_key.strip():
        api_key = input("  AffMine api_key: ").strip()
        if not api_key:
            print("  Error: api_key cannot be empty. Please try again.")

    print()
    return aff_id, api_key


def generate_env_file(ports, aff_id, api_key):
    db_user = "affmine"
    db_pass = "affmine_secret"
    db_name = "affmine_db"
    db_url = f"postgresql://{db_user}:{db_pass}@postgres:{DEFAULT_PORTS['postgres']}/{db_name}"

    content = textwrap.dedent(f"""\
        # Generated by AffMine install.py — do not edit manually
        DASHBOARD_PORT={ports['dashboard']}
        API_PORT={ports['api']}
        POSTGRES_PORT={ports['postgres']}

        POSTGRES_USER={db_user}
        POSTGRES_PASSWORD={db_pass}
        POSTGRES_DB={db_name}
        DATABASE_URL={db_url}

        AFF_ID={aff_id}
        API_KEY={api_key}
    """)

    with open(".env", "w") as f:
        f.write(content)

    return db_user, db_pass, db_name


def generate_dockerignore():
    content = textwrap.dedent("""\
        node_modules
        .git
        .env
        *.log
        dist
        .cache
        .local
        artifacts/mockup-sandbox
    """)
    with open(".dockerignore", "w") as f:
        f.write(content)


def generate_dockerfile():
    content = textwrap.dedent("""\
        # ---- Stage 1: Build ----
        FROM node:20-slim AS builder

        RUN corepack enable && corepack prepare pnpm@latest --activate

        WORKDIR /app

        COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
        COPY tsconfig.json tsconfig.base.json ./

        COPY lib/db/package.json lib/db/
        COPY lib/api-zod/package.json lib/api-zod/
        COPY lib/api-client-react/package.json lib/api-client-react/
        COPY lib/api-spec/package.json lib/api-spec/

        COPY artifacts/api-server/package.json artifacts/api-server/
        COPY artifacts/affmine-dashboard/package.json artifacts/affmine-dashboard/

        RUN pnpm install --frozen-lockfile || pnpm install

        COPY lib/ lib/
        COPY artifacts/api-server/ artifacts/api-server/
        COPY artifacts/affmine-dashboard/ artifacts/affmine-dashboard/

        RUN mkdir -p attached_assets

        RUN pnpm run typecheck:libs || true

        RUN cd artifacts/api-server && pnpm run build

        ENV PORT=3000
        ENV BASE_PATH=/
        RUN cd artifacts/affmine-dashboard && pnpm run build

        # ---- Stage 2: API Server runtime ----
        FROM node:20-slim AS api

        WORKDIR /app

        COPY --from=builder /app/artifacts/api-server/dist/ ./dist/
        COPY --from=builder /app/artifacts/api-server/node_modules/ ./node_modules/

        ENV NODE_ENV=production

        CMD ["node", "--enable-source-maps", "./dist/index.mjs"]

        # ---- Stage 3: Dashboard static files served by nginx ----
        FROM nginx:alpine AS dashboard

        COPY --from=builder /app/artifacts/affmine-dashboard/dist/public/ /usr/share/nginx/html/

        RUN printf 'server {\\n\\
            listen 80;\\n\\
            server_name localhost;\\n\\
            root /usr/share/nginx/html;\\n\\
            index index.html;\\n\\
            location / {\\n\\
                try_files $uri $uri/ /index.html;\\n\\
            }\\n\\
            location /api/ {\\n\\
                proxy_pass http://api:5000/api/;\\n\\
                proxy_set_header Host $host;\\n\\
                proxy_set_header X-Real-IP $remote_addr;\\n\\
            }\\n\\
        }\\n' > /etc/nginx/conf.d/default.conf

        EXPOSE 80

        CMD ["nginx", "-g", "daemon off;"]
    """)

    with open("Dockerfile", "w") as f:
        f.write(content)


def generate_docker_compose(ports, db_user, db_pass, db_name):
    api_internal_port = 5000

    content = textwrap.dedent(f"""\
        version: "3.8"

        services:
          postgres:
            image: postgres:16-alpine
            container_name: {PROJECT_NAME}-postgres
            restart: unless-stopped
            environment:
              POSTGRES_USER: {db_user}
              POSTGRES_PASSWORD: {db_pass}
              POSTGRES_DB: {db_name}
            ports:
              - "{ports['postgres']}:{DEFAULT_PORTS['postgres']}"
            volumes:
              - pgdata:/var/lib/postgresql/data
            healthcheck:
              test: ["CMD-SHELL", "pg_isready -U {db_user} -d {db_name}"]
              interval: 5s
              timeout: 5s
              retries: 10

          api:
            build:
              context: .
              dockerfile: Dockerfile
              target: api
            container_name: {PROJECT_NAME}-api
            restart: unless-stopped
            depends_on:
              postgres:
                condition: service_healthy
            environment:
              PORT: "{api_internal_port}"
              DATABASE_URL: "postgresql://{db_user}:{db_pass}@postgres:{DEFAULT_PORTS['postgres']}/{db_name}"
              AFF_ID: "${{AFF_ID}}"
              API_KEY: "${{API_KEY}}"
              NODE_ENV: production
            ports:
              - "{ports['api']}:{api_internal_port}"

          dashboard:
            build:
              context: .
              dockerfile: Dockerfile
              target: dashboard
            container_name: {PROJECT_NAME}-dashboard
            restart: unless-stopped
            depends_on:
              - api
            ports:
              - "{ports['dashboard']}:80"

        volumes:
          pgdata:
    """)

    with open("docker-compose.yml", "w") as f:
        f.write(content)


def build_and_start(compose_cmd, ports):
    print("[5/5] Building and starting containers...")
    print("  This may take a few minutes on first run.")
    print()

    cmd = compose_cmd + ["-p", PROJECT_NAME, "up", "--build", "-d"]
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True,
    )

    for line in iter(process.stdout.readline, ""):
        print(f"  {line}", end="")

    process.wait()

    if process.returncode != 0:
        print()
        print("  ERROR: docker-compose up failed. Check the output above for details.")
        sys.exit(1)

    print()
    print_status(compose_cmd)

    print()
    print("=" * 60)
    print("  AffMine Dashboard is running!")
    print()
    print(f"  Dashboard:  http://localhost:{ports['dashboard']}")
    print(f"  API Server: http://localhost:{ports['api']}/api")
    print(f"  PostgreSQL: localhost:{ports['postgres']}")
    print()
    print("  Useful commands:")
    print(f"    python {sys.argv[0]} --status   Check container status")
    print(f"    python {sys.argv[0]} --stop     Stop all containers")
    print()
    print("  Note: Credentials are stored in .env — do not commit")
    print("  this file to version control.")
    print("=" * 60)
    print()


def stop_containers(compose_cmd):
    print("Stopping AffMine containers...")
    result = subprocess.run(
        compose_cmd + ["-p", PROJECT_NAME, "down"],
        universal_newlines=True,
    )
    if result.returncode == 0:
        print("All containers stopped.")
    else:
        print("Error stopping containers.")
    sys.exit(result.returncode)


def print_status(compose_cmd):
    print("AffMine container status:")
    print()
    subprocess.run(
        compose_cmd + ["-p", PROJECT_NAME, "ps"],
        universal_newlines=True,
    )


def show_status(compose_cmd):
    print_status(compose_cmd)
    sys.exit(0)


def main():
    print_banner()
    detected_os = detect_os()
    print_os_info(detected_os)

    if "--stop" in sys.argv:
        compose_cmd = find_docker_compose_cmd()
        if not compose_cmd:
            print("ERROR: Docker Compose not found.")
            sys.exit(1)
        stop_containers(compose_cmd)
        return

    if "--status" in sys.argv:
        compose_cmd = find_docker_compose_cmd()
        if not compose_cmd:
            print("ERROR: Docker Compose not found.")
            sys.exit(1)
        show_status(compose_cmd)
        return

    compose_cmd = check_docker(detected_os)
    ports = scan_ports()
    aff_id, api_key = prompt_credentials()

    print("[4/5] Generating configuration files...")
    db_user, db_pass, db_name = generate_env_file(ports, aff_id, api_key)
    generate_dockerignore()
    generate_dockerfile()
    generate_docker_compose(ports, db_user, db_pass, db_name)
    print("  Created: .env")
    print("  Created: .dockerignore")
    print("  Created: Dockerfile")
    print("  Created: docker-compose.yml")
    print()

    build_and_start(compose_cmd, ports)


if __name__ == "__main__":
    main()
