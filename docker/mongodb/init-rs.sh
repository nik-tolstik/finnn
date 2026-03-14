#!/bin/sh
set -eu

uri='mongodb://mongodb:27017/?directConnection=true'
expected_host='localhost:27017'

echo "Waiting for MongoDB to accept connections..."
until [ "$(mongosh "$uri" --quiet --eval 'db.adminCommand({ ping: 1 }).ok' 2>/dev/null || echo 0)" = "1" ]; do
  sleep 1
done

current_host="$(mongosh "$uri" --quiet --eval 'try { print(rs.conf().members[0].host) } catch (error) { if (error.code === 94 || error.codeName === "NotYetInitialized") { print("") } else { throw error } }')"

if [ -z "$current_host" ]; then
  echo "Initializing replica set rs0..."
  mongosh "$uri" --quiet --eval "rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '$expected_host' }] })"
elif [ "$current_host" != "$expected_host" ]; then
  echo "Reconfiguring replica set member from $current_host to $expected_host..."
  mongosh "$uri" --quiet --eval "rs.reconfig({ _id: 'rs0', members: [{ _id: 0, host: '$expected_host' }] }, { force: true })"
else
  echo "Replica set already configured for $expected_host."
fi

echo "Waiting for replica set primary..."
until [ "$(mongosh "$uri" --quiet --eval 'const hello = db.adminCommand({ hello: 1 }); print(hello.isWritablePrimary ? 1 : 0)' 2>/dev/null || echo 0)" = "1" ]; do
  sleep 1
done

echo "Replica set rs0 is ready."
