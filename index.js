const { typeBundleForPolkadot } = require('@kiltprotocol/type-definitions')
const { ApiPromise, WsProvider } = require('@polkadot/api')
const { cryptoWaitReady } = require('@polkadot/util-crypto')
const prom_client = require('prom-client')
const express = require('express')
var http = require('http')

function get_timestamp(block) {
    let tx_set_time = block.extrinsics.find((tx) => tx.method.section === "timestamp")
    return tx_set_time.method.args[0].toNumber()
}

function note_skipped_slots(chain_state, block_num, current_slot) {
    let i = 1
    while ((chain_state.last_slot + i) < current_slot) {
        let skipper = chain_state.authors[(chain_state.last_slot + i) % chain_state.authors.length]
        console.log(`Author skipped slot  #${chain_state.last_slot + i} block #${block_num}: ${skipper}`)
        chain_state.offline_count.labels({ author: skipper }).inc(1)
        i += 1
    }
}

async function note_new_head(api, chain_state, header) {
    const signed_block = await api.derive.chain.getBlock(header.hash)
    const time = get_timestamp(signed_block.block)
    const slot = Math.floor(time / 12_000)
    const author = chain_state.authors[(slot) % chain_state.authors.length]

    // don't note skipped slots because we don't know which slots where skipped.
    if (chain_state.last_slot !== null) {
        note_skipped_slots(chain_state, header.number, chain_state.last_slot, slot)
    }

    process.stdout.write(`Author authored slot #${slot} block #${header.number}: ${author}\n`)

    chain_state.online_count.labels({ author }).inc(1)
    chain_state.last_slot = slot
}

async function watchForOffline(api) {
    const online_count = new prom_client.Counter({
        name: 'blocks_authored',
        help: 'the number of blocks build by an author',
        labelNames: ["author"]
    })
    const offline_count = new prom_client.Counter({
        name: 'blocks_skipped',
        help: 'the number of blocks skipped by an author',
        labelNames: ["author"]
    })

    let current_round = await api.query.parachainStaking.round()

    let chain_state = {
        authors: await api.query.session.validators(),
        last_slot: null,
        online_count,
        offline_count,
    }

    api.query.session.validators((new_validators) => {
        console.log("New validator set")
        chain_state.authors = new_validators
    })

    console.log(`\
Index:  ${current_round.current}
Start:  ${current_round.first}
End:    ${chain_state.round_end}`)

    await new Promise((resolve, reject) => {
        api.derive.chain.subscribeNewHeads((header) => {
            note_new_head(api, chain_state, header)
        })
    })
}

async function setup_api_connection(ws_address) {
    await cryptoWaitReady()

    const api = await ApiPromise.create({
        provider: new WsProvider(ws_address),
        typesBundle: {
            spec: {
                'mashnet-node': typeBundleForPolkadot,
                'kilt-spiritnet': typeBundleForPolkadot,
            },
        },
    })

    console.log(`Start fun!
chain:      ${api.runtimeChain.toString()}
spec-name:  ${api.runtimeVersion.specName.toString()}
version:    ${api.runtimeVersion.specVersion.toString()}
`)
    return api
}

function setup_webserver(port, host) {
    const app = express()
    const register = prom_client.register

    app.get('/metrics', async (req, res) => {
        try {
            res.set('Content-Type', register.contentType)
            res.end(await register.metrics())
        } catch (ex) {
            res.status(500).end(ex)
        }
    })

    console.log(
        `Server listening on http://${host}:${port}/metrics`,
    )

    return http.createServer(app).listen({
        host,
        port,
    })
}

async function execute() {
    const port = process.env.PORT || 9102
    const host = process.env.HOST || 'localhost'
    const ws_address = process.env.WS_ADDRESS || 'wss://peregrine.kilt.io'

    const api = await setup_api_connection(ws_address)

    setup_webserver(port, host)

    await watchForOffline(api)

    await api.disconnect()
    console.log(`End fun`)
}

execute()
