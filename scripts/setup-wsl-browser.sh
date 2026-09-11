#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
libs_dir="$project_root/.playwright-libs"
lists_dir="$libs_dir/lists"
ubuntu_sources="/etc/apt/sources.list.d/ubuntu.sources"

if [[ "$(dpkg --print-architecture)" != "amd64" ]] || [[ ! -f "$ubuntu_sources" ]]; then
  echo "Este instalador local suporta Ubuntu 24.04 amd64 no WSL."
  echo "Em outra distribuição, use: sudo npx playwright install-deps chromium"
  exit 1
fi

cd "$project_root"
npx playwright install chromium

mkdir -p "$lists_dir/partial"

apt-get \
  -o "Dir::Etc::sourcelist=$ubuntu_sources" \
  -o "Dir::Etc::sourceparts=-" \
  -o "Dir::State::lists=$lists_dir" \
  update

cd "$libs_dir"
apt \
  -o "Dir::Etc::sourcelist=$ubuntu_sources" \
  -o "Dir::Etc::sourceparts=-" \
  -o "Dir::State::lists=$lists_dir" \
  download libnspr4 libnss3 libasound2t64

for package_file in ./*.deb; do
  dpkg-deb -x "$package_file" .
done

echo "Chromium e bibliotecas locais do WSL estão prontos."
