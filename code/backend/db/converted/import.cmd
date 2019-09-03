SET PGCLIENTENCODING=utf-8
chcp 65001
psql -h localhost -p 7000 -U postgres -d gis --echo-hidden -q -f all.sql