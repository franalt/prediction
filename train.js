const ModelsService = require("./services/models.service");
const Utils = require("./utils");

const candlestickMap = {
    down: 0,
    doji: 1,
    up: 2
};

const trendMap = {
    uptrend: 2,
    neutral: 1,
    downtrend: 0
};

const eventMap = {
    bb_bottom_cross_up: 1,
    bb_bottom_cross_down: 2,
    bb_top_cross_up: 3,
    bb_top_cross_up: 4,
    bb_top_cross_down: 5,
    supertrend_sell: 6,
    supertrend_buy: 7,
    cci_oversold_start: 8,
    cci_oversold_end: 9,
    cci_overbought_start: 10,
    cci_overbought_end: 11,
    rsi7_oversold_start: 12,
    rsi7_oversold_end: 13,
    rsi7_overbought_start: 14,
    rsi7_overbought_end: 15,
    rsi14_oversold_start: 16,
    rsi14_oversold_end: 17,
    rsi14_overbought_start: 18,
    rsi14_overbought_end: 19,
    mfi_oversold_start: 20,
    mfi_oversold_end: 21,
    mfi_overbought_start: 22,
    mfi_overbought_end: 23,
    macd_bearish_momentum_decay: 24,
    macd_bullish_momentum_decay: 25,
    macd_bullish_crossover: 26,
    macd_bearish_crossover: 27,
    emaFast_bullish_crossover: 28,
    emaFast_bearish_crossover: 29,
    emaSlow_bullish_crossover: 30,
    emaSlow_bearish_crossover: 31
};

async function run() {
    let model = await ModelsService.loadModel({ name: "test" });
    if (!model) {
        model = await ModelsService.createModel({
            input_layer_neurons: 64,
            input_data_features: 16,
            hidden_layers: 1,
            output_layer_neurons: 1,
            output_layer_features: 1,
            learning_rate: 0.01
        });
    }
    let data = (await Utils.readJSON("BTCUSDT")).map((object) => {
        return [
            object.close,
            object.open,
            object.high,
            object.low,
            object.volume,
            Math.abs(object.atr14) || 0,
            Math.abs(object.cci14) || 0,
            Math.abs(object.mfi14) || 0,
            Math.abs(object.rsi7) || 0,
            Math.abs(object.rsi14) || 0,
            Math.abs(eventMap[object.events[0]] || 0),
            Math.abs(eventMap[object.events[1]] || 0),
            Math.abs(eventMap[object.events[2]] || 0),
            Math.abs(eventMap[object.events[3]] || 0),
            Math.abs(trendMap[object.trend] || 0),
            Math.abs(candlestickMap[object.candlestick] || 0)
        ];
    });
    data = data.slice(-200);
    let { dictionary } = await ModelsService.trainModel({
        model,
        data,
        split: 0.8,
        batch_size: 100,
        epochs: 1
    });
    await ModelsService.saveModel({
        name: "test",
        model,
        dictionary
    });
    await ModelsService.makePrediction({
        model,
        data: data.slice(-100),
        dictionary
    });
}
run();
