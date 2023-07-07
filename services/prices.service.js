"use strict";

const fs = require("fs");
const Binance = require("node-binance-api");
const binance = new Binance();

const ATR = require("technicalindicators").ATR;
const CCI = require("technicalindicators").CCI;
const SMA = require("technicalindicators").SMA;
const EMA = require("technicalindicators").EMA;
const MACD = require("technicalindicators").MACD;
const MFI = require("technicalindicators").MFI;
const RSI = require("technicalindicators").RSI;
const BB = require("technicalindicators").BollingerBands;
var Stock = require("stock-technical-indicators");
const Indicator = Stock.Indicator;
const { Supertrend } = require("stock-technical-indicators/study/Supertrend");

const PricesService = {
    getPrices: async function ({ symbol, from, to }) {
        from = Number(from);
        to = Number(to);
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

                        for (let i = 0; i < filteredTicks.length; i++) {
                            let tick = filteredTicks[i];
                            const timestamp = new Date(parseInt(tick[0])).toLocaleString();
                            let open = Number(tick[1]);
                            let high = Number(tick[2]);
                            let low = Number(tick[3]);
                            let close = Number(tick[4]);
                            let volume = Number(tick[5]);
                            let went_up = 0;
                            if (i + 1 < filteredTicks.length && filteredTicks[i + 1][4] > close) {
                                went_up = 1;
                            }
                            filteredTicks[i] = { timestamp, open, high, low, close, volume, went_up };
                        }

                        /*const priceData = filteredTicks.map((tick) => {
                            
                        });*/

                        return resolve(filteredTicks);
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
    },
    getChart: async function ({ pair, interval, from, to }) {
        return new Promise(async function (resolve, reject) {
            if (!from) {
                return reject("Missing from");
            }
            if (!to) {
                return reject("Missing to");
            }
            console.log(process.pid, "Getting chart", {
                pair,
                interval,
                from,
                to
            });
            pair = {
                pair,
                atr14: new ATR({
                    high: [],
                    low: [],
                    close: [],
                    period: 14
                }),
                cci14: new CCI({
                    open: [],
                    high: [],
                    low: [],
                    close: [],
                    period: 14
                }),
                mfi14: new MFI({
                    high: [],
                    low: [],
                    close: [],
                    volume: [],
                    period: 14
                }),
                rsi7: new RSI({
                    values: [],
                    period: 7
                }),
                rsi14: new RSI({
                    values: [],
                    period: 14
                }),
                ema7: new EMA({
                    values: [],
                    period: 7
                }),
                ema25: new EMA({
                    values: [],
                    period: 25
                }),
                ema99: new EMA({
                    values: [],
                    period: 99
                }),
                ema200: new EMA({
                    values: [],
                    period: 99
                }),
                bb: new BB({
                    values: [],
                    period: 20,
                    stdDev: 3
                }),
                macd: new MACD({
                    values: [],
                    fastPeriod: 10,
                    slowPeriod: 20,
                    signalPeriod: 5,
                    SimpleMAOscillator: true,
                    SimpleMASignal: true
                }),
                candles: []
            };
            let candles = [];
            get();
            async function get() {
                from = new Date(candles.length > 0 ? candles[candles.length - 1].timestamp : from);
                from.setMilliseconds(1);
                var results = await PricesService.getCandles(pair.pair, interval, from);
                if (results.length) {
                    candles.push(...results);
                    get();
                } else {
                    console.log("Analyzing candles");
                    for (let i = 0; i < candles.length; i++) {
                        PricesService.analyzeCandle(pair, candles[i]);
                        if (i > 0) {
                            candles[i].previous = {
                                ...candles[i - 1],
                                previous: undefined
                            };
                        }
                    }
                    console.log(candles[candles.length - 1]);
                    return resolve(candles);
                }
            }
        });
    },
    getCandles: async function (pair, interval, from) {
        return new Promise(async function (resolve, reject) {
            try {
                console.log(process.pid, "Getting candles", {
                    pair: pair,
                    interval: interval,
                    from: from
                });
                var ticks = await binance.futuresCandles(pair.replace("/", ""), interval, {
                    limit: 500,
                    startTime: Number(from)
                });
                //await waitFor(500);
                var candles = [];
                for (var i = 0; i < ticks.length; i++) {
                    var [time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored] = ticks[i];
                    var candle = {
                        interval,
                        pair: pair,
                        timestamp: new Date(time),
                        open: Number(open),
                        high: Number(high),
                        low: Number(low),
                        close: Number(close),
                        volume: Number(volume),
                        avg: (Number(open) + Number(close)) / 2,
                        body: Math.abs(Number(open) - Number(close)),
                        candlestick: undefined,
                        events: [],
                        next: 0
                    };
                    if (Math.abs(1 - candle.open / candle.close) <= 0.001) {
                        candle.candlestick = "doji";
                    } else if (candle.close > candle.open) {
                        candle.candlestick = "up";
                    } else if (candle.close < candle.open) {
                        candle.candlestick = "down";
                    }
                    if (candle.open >= candle.close) {
                        candle.top = candle.open;
                        candle.bottom = candle.close;
                    } else {
                        candle.top = candle.close;
                        candle.bottom = candle.open;
                    }
                    if (ticks[i + 1]) {
                        candle.next = ticks[i + 1][4] > close ? 1 : 0;
                    }
                    candles.push(candle);
                }
                return resolve(candles);
            } catch (error) {
                console.error(error);
                return reject();
            }
        });
    },
    analyzeCandle(pair, candle) {
        candle.atr14 = pair.atr14.nextValue({
            high: candle.high,
            low: candle.low,
            close: candle.close
        });
        candle.cci14 = pair.cci14.nextValue({
            open: candle.close,
            high: candle.close,
            low: candle.close,
            close: candle.close
        });
        candle.mfi14 = pair.mfi14.nextValue({
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume
        });
        candle.bb = pair.bb.nextValue(candle.close);
        candle.rsi7 = pair.rsi7.nextValue(candle.close);
        candle.rsi14 = pair.rsi14.nextValue(candle.close);
        candle.ema7 = pair.ema7.nextValue(candle.close);
        candle.ema25 = pair.ema25.nextValue(candle.close);
        candle.ema99 = pair.ema99.nextValue(candle.close);
        candle.ema200 = pair.ema200.nextValue(candle.close);
        candle.macd = pair.macd.nextValue(candle.close);
        if (candle.bb) {
            if (candle.open < candle.bb.lower && candle.close > candle.bb.lower) {
                candle.bb = "inside";
                candle.events.push("bb_bottom_cross_up");
            } else if (candle.open > candle.bb.lower && candle.close < candle.bb.lower) {
                candle.bb = "below";
                candle.events.push("bb_bottom_cross_down");
            } else if (candle.open < candle.bb.upper && candle.close > candle.bb.upper) {
                candle.bb = "above";
                candle.events.push("bb_top_cross_up");
            } else if (candle.open > candle.bb.upper && candle.close < candle.bb.upper) {
                candle.bb = "inside";
                candle.events.push("bb_top_cross_down");
            } else if (candle.open > candle.bb.lower && candle.close > candle.bb.lower && candle.open < candle.bb.upper && candle.close < candle.bb.upper) {
                candle.bb = "inside";
            } else if (candle.open > candle.bb.upper && candle.close > candle.bb.upper) {
                candle.bb = "above";
            } else if (candle.open < candle.bb.lower && candle.close < candle.bb.lower) {
                candle.bb = "below";
            }
        }
        if (candle.ema25 && candle.ema200 && candle.ema25 > candle.ema200) {
            candle.trend = "uptrend";
        } else if (candle.ema25 && candle.ema200 && candle.ema25 < candle.ema200) {
            candle.trend = "downtrend";
        } else {
            candle.trend = "neutral";
        }
        var direction;
        var previous_candle;
        for (var j = pair.candles.length - 2; j >= pair.candles.length - 5 && pair.candles.length > 50; j--) {
            if (j === pair.candles.length - 2) {
                previous_candle = pair.candles[j];
                direction = previous_candle.macd.direction;
                if (previous_candle.macd.histogram < candle.macd.histogram) {
                    candle.macd.direction = 1;
                } else {
                    candle.macd.direction = -1;
                }
            } else if (pair.candles[j].macd.direction !== direction) {
                direction = undefined;
            }
        }
        if (pair.candles.length >= 100) {
            var supertrend_candles = [];
            for (var k = pair.candles.length - 100; k < pair.candles.length - 1; k++) {
                if (pair.candles[k].timestamp < candle.timestamp) {
                    supertrend_candles.push([pair.candles[k].timestamp, pair.candles[k].open, pair.candles[k].high, pair.candles[k].low, pair.candles[k].close, pair.candles[k].volume]);
                }
            }
            var newStudySupertrend = new Indicator(new Supertrend());
            candle.supertrend = newStudySupertrend.calculate(supertrend_candles, { period: 7, multiplier: 3 })[supertrend_candles.length - 1].Supertrend.Direction;
            if (candle.supertrend === 1) {
                candle.supertrend = "buy";
            } else {
                candle.supertrend = "sell";
            }
        }
        if (previous_candle) {
            if (candle.supertrend) {
                if (previous_candle.supertrend === "buy" && candle.supertrend === "sell") {
                    candle.events.push("supertrend_sell");
                } else if (previous_candle.supertrend === "sell" && candle.supertrend === "buy") {
                    candle.events.push("supertrend_buy");
                }
            }
            if (candle.cci) {
                if (previous_candle.cci > -200 && candle.cci < -200) {
                    candle.events.push("cci_oversold_start");
                }
                if (previous_candle.cci < -200 && candle.cci > -200) {
                    candle.events.push("cci_oversold_end");
                }
                if (previous_candle.cci < 200 && candle.cci > 200) {
                    candle.events.push("cci_overbought_start");
                }
                if (previous_candle.cci > 200 && candle.cci < 200) {
                    candle.events.push("cci_overbought_end");
                }
            }
            if (candle.rsi7) {
                if (previous_candle.rsi7 > 30 && candle.rsi7 < 30) {
                    candle.events.push("rsi7_oversold_start");
                }
                if (previous_candle.rsi7 < 30 && candle.rsi7 > 30) {
                    candle.events.push("rsi7_oversold_end");
                }
                if (previous_candle.rsi7 < 70 && candle.rsi7 > 70) {
                    candle.events.push("rsi7_overbought_start");
                }
                if (previous_candle.rsi7 > 70 && candle.rsi7 < 70) {
                    candle.events.push("rsi7_overbought_end");
                }
            }
            if (candle.rsi14) {
                if (previous_candle.rsi14 > 30 && candle.rsi14 < 30) {
                    candle.events.push("rsi14_oversold_start");
                }
                if (previous_candle.rsi14 < 30 && candle.rsi14 > 30) {
                    candle.events.push("rsi14_oversold_end");
                }
                if (previous_candle.rsi14 < 70 && candle.rsi14 > 70) {
                    candle.events.push("rsi14_overbought_start");
                }
                if (previous_candle.rsi14 > 70 && candle.rsi14 < 70) {
                    candle.events.push("rsi14_overbought_end");
                }
            }
            if (candle.mfi) {
                if (previous_candle.mfi > 20 && candle.mfi < 20) {
                    candle.events.push("mfi_oversold_start");
                }
                if (previous_candle.mfi < 20 && candle.mfi > 20) {
                    candle.events.push("mfi_oversold_end");
                }
                if (previous_candle.mfi < 80 && candle.mfi > 80) {
                    candle.events.push("mfi_overbought_start");
                }
                if (previous_candle.mfi > 80 && candle.mfi < 80) {
                    candle.events.push("mfi_overbought_end");
                }
            }
            if (candle.macd) {
                if (candle.macd.histogram > previous_candle.macd.histogram && direction === -1) {
                    candle.events.push("macd_bearish_momentum_decay");
                } else if (candle.macd.histogram < previous_candle.macd.histogram && direction === 1) {
                    candle.events.push("macd_bullish_momentum_decay");
                }
                if (previous_candle.macd.histogram < 0 && candle.macd.histogram > 0) {
                    candle.events.push("macd_bullish_crossover");
                } else if (previous_candle.macd.histogram > 0 && candle.macd.histogram < 0) {
                    candle.events.push("macd_bearish_crossover");
                }
                if (candle.macd.histogram > 0) {
                    candle.macd = "bullish";
                } else {
                    candle.macd = "bearish";
                }
            }
            if (candle.ema25 && previous_candle.ema25) {
                if (previous_candle.ema7 < previous_candle.ema25 && candle.ema7 > candle.ema25) {
                    candle.events.push("emaFast_bullish_crossover");
                } else if (previous_candle.ema7 > previous_candle.ema25 && candle.ema7 < candle.ema25) {
                    candle.events.push("emaFast_bearish_crossover");
                }
                if (candle.ema7 > candle.ema25) {
                    candle.emaFast = "bullish";
                } else {
                    candle.emaFast = "bearish";
                }
            }
            if (candle.ema99 && previous_candle.ema99) {
                if (previous_candle.ema25 < previous_candle.ema99 && candle.ema25 > candle.ema99) {
                    candle.events.push("emaSlow_bullish_crossover");
                } else if (previous_candle.ema25 > previous_candle.ema99 && candle.ema25 < candle.ema99) {
                    candle.events.push("emaSlow_bearish_crossover");
                }
                if (candle.ema25 > candle.ema99) {
                    candle.emaSlow = "bullish";
                } else {
                    candle.emaSlow = "bearish";
                }
            }
        }
    }
};

module.exports = PricesService;
