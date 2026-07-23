#!/usr/bin/env bash
set -euo pipefail

app_dir="/home/karlsubuntu/fliplens"
service_source="$app_dir/deploy/fliplens.service"
nginx_source="$app_dir/deploy/nginx-fliplens.conf"
service_target="/etc/systemd/system/fliplens.service"
nginx_target="/etc/nginx/sites-available/fliplens"
nginx_link="/etc/nginx/sites-enabled/fliplens"
env_target="/home/karlsubuntu/.fliplens.env"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"

[[ "$(id -u)" == "0" ]] || { echo "Run this installer with sudo." >&2; exit 1; }
[[ -f "$service_source" && -f "$nginx_source" ]] || { echo "Deployment files are missing from $app_dir." >&2; exit 1; }

systemd-analyze verify "$service_source"

service_backup=""
nginx_backup=""
if [[ -e "$service_target" ]]; then
  service_backup="${service_target}.backup-${timestamp}"
  cp --preserve=all "$service_target" "$service_backup"
fi
if [[ -e "$nginx_target" ]]; then
  nginx_backup="${nginx_target}.backup-${timestamp}"
  cp --preserve=all "$nginx_target" "$nginx_backup"
fi

install -o root -g root -m 0644 "$service_source" "$service_target"
install -o root -g root -m 0644 "$nginx_source" "$nginx_target"

if [[ -L "$nginx_link" ]]; then
  [[ "$(readlink -f "$nginx_link")" == "$nginx_target" ]] || { echo "$nginx_link points somewhere unexpected." >&2; exit 1; }
elif [[ -e "$nginx_link" ]]; then
  echo "$nginx_link exists and is not a symlink." >&2
  exit 1
else
  ln -s "$nginx_target" "$nginx_link"
fi

if ! nginx -t; then
  rm -f "$nginx_link"
  if [[ -n "$nginx_backup" ]]; then mv "$nginx_backup" "$nginx_target"; else rm -f "$nginx_target"; fi
  if [[ -n "$service_backup" ]]; then mv "$service_backup" "$service_target"; else rm -f "$service_target"; fi
  echo "Nginx validation failed; installed files were rolled back." >&2
  exit 1
fi

if [[ ! -e "$env_target" ]]; then
  install -o karlsubuntu -g karlsubuntu -m 0600 "$app_dir/.env.example" "$env_target"
fi

systemctl daemon-reload
echo "FlipLens configuration installed and validated. Service not started; Nginx not reloaded."
