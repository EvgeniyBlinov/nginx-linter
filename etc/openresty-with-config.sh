#!/bin/bash -e

docker run \
    --name nginx-linter-test-container \
    -v "`pwd`/$1:/usr/local/openresty/nginx/conf/nginx.conf:ro" \
    -p 8080:80 \
    --rm \
    openresty/openresty:stretch
