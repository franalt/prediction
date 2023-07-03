"use strict";

const Binance = require("node-binance-api");
const binance = new Binance();

const PricesService = {
    getPrices: async function ({ symbol, from, to }) {
        const interval = 3600 * 1000; // 1 hour interval in milliseconds
        const chunkSize = 500; // Number of candlesticks per request

        let startTime = from;
        let endTime = startTime + interval * chunkSize;

        const promises = [];

        while (startTime < to) {
            const promise = new Promise((resolve, reject) => {
                binance.candlesticks(
                    symbol,
                    "1h",
                    (error, ticks) => {
                        if (error) {
                            reject(error);
                            return;
                        }

                        const filteredTicks = ticks.filter((tick) => {
                            const timestamp = parseInt(tick[0]);
                            return timestamp >= from && timestamp <= to;
                        });

                        const priceData = filteredTicks.map((tick) => {
                            const timestamp = new Date(parseInt(tick[0])).toLocaleString();
                            const open = tick[1];
                            const high = tick[2];
                            const low = tick[3];
                            const close = tick[4];
                            const volume = tick[5];
                            return { timestamp, open, high, low, close, volume };
                        });

                        resolve(priceData);
                    },
                    { startTime, endTime }
                );
            });

            promises.push(promise);

            startTime = endTime;
            endTime = startTime + interval * chunkSize;
            endTime = Math.min(endTime, to);
        }

        return Promise.all(promises)
            .then((results) => results.flat())
            .catch((error) => {
                console.error(error);
                throw error;
            });
    }
};

module.exports = PricesService;
