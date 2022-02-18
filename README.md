# Note Authors

Provides a prometheus server that counts who has authored a block and who missed his slot.

assumes you are

* connecting to a KILT chain
* using AURA
* having the session-pallet

## configuration

use environment variables

* `PORT` where to listen for prometheus queries (default: `9102`)
* `HOST` where to listen for prometheus queries (default: `localhost`)
* `WS_ADDRESS` to which rpc node should we connect (default `wss://peregrine.kilt.io`)
