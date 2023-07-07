const cluster = require("cluster");
const PricesService = require("./services/prices.service");
const Utils = require("./utils");

var pairs = ["BTC/USDT", "ETH/USDT"];

const from = new Date();
from.setFullYear(from.getFullYear() - 1);
const to = new Date();

var cpus = 2; //require("os").cpus().length;
if (cluster.isMaster) {
    for (var i = 0; i < cpus; i += 1) {
        cluster.fork();
    }
    cluster.on("exit", function () {
        cluster.fork();
    });
} else {
    console.log(process.pid, "Starting CANDLE worker", cluster.worker.id + "/" + cpus);
    var pairs_per_worker = Math.ceil(pairs.length / cpus);
    pairs = pairs.slice((cluster.worker.id - 1) * pairs_per_worker, (cluster.worker.id - 1) * pairs_per_worker + pairs_per_worker);
    run();
}

async function run() {
    console.log(process.pid, "Pairs for worker " + cluster.worker.id, pairs);
    for (let i = 0; i < pairs.length; i++) {
        let pair = pairs[i].replace("/", "");
        await Utils.saveJSON(
            pair,
            await PricesService.getChart({
                pair,
                interval: "1h",
                from,
                to
            })
        );
    }
}
