const { typeBundleForPolkadot } = require('@kiltprotocol/type-definitions')
const { ApiPromise, WsProvider } = require('@polkadot/api')
const { cryptoWaitReady } = require('@polkadot/util-crypto')
const promClient = require('prom-client')
const express = require('express')
const http = require('http')

function getTimestamp(block) {
    let txSetTime = block.extrinsics.find((tx) => tx.method.section === "timestamp")
    return txSetTime.method.args[0].toNumber()
}

function noteSkippedSlots(chainState, blockNum, currentSlot) {
    let i = 1
    while ((chainState.lastSlot + i) < currentSlot) {
        const skipper = chainState.authors[(chainState.lastSlot + i) % chainState.authors.length]
        chainState.offlineCount.labels({ author: skipper }).inc(1)
        console.log(`💤 block #${blockNum} at slot #${chainState.lastSlot + i} skipped by  ${skipper}`)

        i += 1
    }
}

async function noteNewHead(api, chainState, header) {
    const signedBlock = await api.derive.chain.getBlock(header.hash)
    const time = getTimestamp(signedBlock.block)
    const slot = Math.floor(time / 12_000)
    const author = chainState.authors[(slot) % chainState.authors.length]

    // don't note skipped slots because we don't know which slots where skipped.
    if (chainState.lastSlot !== null) {
        noteSkippedSlots(chainState, header.number, slot)
    }

    console.log(`💌 block #${header.number} at slot #${slot} authored by ${author}`)

    chainState.onlineCount.labels({ author }).inc(1)
    chainState.lastSlot = slot
}

async function watchForOffline(api) {
    const onlineCount = new promClient.Counter({
        name: 'blocks_authored',
        help: 'the number of blocks build by an author',
        labelNames: ["author"]
    })
    const offlineCount = new promClient.Counter({
        name: 'blocks_skipped',
        help: 'the number of blocks skipped by an author',
        labelNames: ["author"]
    })

    let chainState = {
        authors: await api.query.session.validators(),
        lastSlot: null,
        onlineCount,
        offlineCount,
    }

    api.on("disconnected", () => {
        console.log("🪦 ws connection lost.")
        // we might skip blocks when disconnected.
        chainState.lastSlot = null
    })

    const validatorUnsub = await api.query.session.validators((newValidators) => {
        console.log("🗳️ New validator set")
        chainState.authors = newValidators
    })

    const headUnsub = await api.derive.chain.subscribeNewHeads((header) => {
        noteNewHead(api, chainState, header)
    })

    return () => {
        validatorUnsub()
        headUnsub()
    }
}

async function setupApiConnection(wsAddress) {
    await cryptoWaitReady()

    const api = await ApiPromise.create({
        provider: new WsProvider(wsAddress),
        typesBundle: {
            spec: {
                'mashnet-node': typeBundleForPolkadot,
                'kilt-spiritnet': typeBundleForPolkadot,
            },
        },
    })

    await api.isReady

    console.log(`\
chain:      ${api.runtimeChain.toString()}
spec-name:  ${api.runtimeVersion.specName.toString()}
version:    ${api.runtimeVersion.specVersion.toString()}`)
    return api
}

function setupWebserver(port, host) {
    const app = express()
    const register = promClient.register

    app.get('/metrics', async (req, res) => {
        try {
            res.set('Content-Type', register.contentType)
            res.end(await register.metrics())
        } catch (ex) {
            res.status(500).end(ex)
        }
    })

    console.log(
        `📫 Server listening on http://${host}:${port}/metrics`,
    )

    return http.createServer(app).listen({
        host,
        port,
    })
}

async function execute() {
    const port = process.env.PORT || 9102
    const host = process.env.HOST || 'localhost'
    const wsAddress = process.env.WS_ADDRESS || 'wss://peregrine.kilt.io'

    console.log("👀 Watch block authors")

    setupWebserver(port, host)

    const api = await setupApiConnection(wsAddress)

    const unsub = await watchForOffline(api)

    const cleanup = () => {
        unsub()
        api.disconnect().then(() => {
            console.log(`End fun`)
            process.exit(0)
        })
    }

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // wait infinitely
    await new Promise((res, rej) => { })
}

execute()
