#!/bin/sh
set -eu
umask 077
node dist/db/backup.js /backups
find /backups -name 'flagheist-*.db' -mtime +7 -delete
