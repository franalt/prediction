const fs = require("fs");
const brain = require("brain.js");
const Utils = require("./utils");
const PricesService = require("./services/prices.service.js");

start();

async function start() {
    var from = new Date();
    from.setDate(from.getDate() - 120);
    var to = new Date();
    await Utils.saveJSON("btcusdt", {
        pair: "BTC/USDT",
        candlesticks: await PricesService.getChart({
            pair: "BTC/USDT",
            interval: "1h",
            from,
            to
        })
    });
    console.log("Done");
}
