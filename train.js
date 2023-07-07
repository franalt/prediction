const fs = require("fs");
const brain = require("brain.js");
const Utils = require("./utils");
const PricesService = require("./services/prices.service.js");
const ProgressBar = require("progress");

const modelFilePath = "./model/model.json";
var trainingData;

function createNewModel() {
    const model = new brain.NeuralNetwork({
        inputSize: 32,
        hiddenLayers: [64, 128, 64]
    });
    return model;
}

const totalIterations = 2000;

function trainModelAndSave(model, totalIterations) {
    console.log("Training data");

    const trainingOptions = {
        iterations: totalIterations,
        log: false,
        logPeriod: 100,
        callback: (stats) => {
            progressBar.tick();
        }
    };

    const progressBar = new ProgressBar(":bar :percent :etas", {
        total: totalIterations / 10,
        width: 30
    });

    const trainingDataFormatted = trainingData.map((data) => ({
        input: data.input,
        output: data.output
    }));

    model.train(trainingDataFormatted, trainingOptions);

    const modelJson = model.toJSON();
    fs.writeFileSync(modelFilePath, JSON.stringify(modelJson));
}

function loadModelFromFile() {
    if (fs.existsSync(modelFilePath)) {
        const modelJson = fs.readFileSync(modelFilePath, "utf8");
        const model = createNewModel();
        model.fromJSON(JSON.parse(modelJson));
        console.log("Model loaded from file.");
        return model;
    }

    console.log("Model file not found. Creating a new model.");
    return createNewModel();
}

function predict(model, newData) {
    const prediction = model.run(newData)[0];
    return prediction;
}

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

const model = loadModelFromFile();
start();

function mapCandle(object) {
    return {
        input: [
            Math.ceil(object.previous?.open) || 0,
            Math.ceil(object.previous?.high) || 0,
            Math.ceil(object.previous?.low) || 0,
            Math.ceil(object.previous?.close) || 0,
            Math.ceil(object.previous?.volume) || 0,
            Math.ceil(object.previous?.atr14) || 0,
            Math.ceil(object.previous?.cci14) || 0,
            Math.ceil(object.previous?.mfi14) || 0,
            Math.ceil(object.previous?.rsi7) || 0,
            Math.ceil(object.previous?.rsi14) || 0,
            Math.ceil(object.previous?.ema7) || 0,
            Math.ceil(object.previous?.ema25) || 0,
            Math.ceil(object.previous?.ema99) || 0,
            Math.ceil(object.previous?.ema200) || 0,
            trendMap[object.previous?.trend] || 0,
            candlestickMap[object.previous?.candlestick] || 0,
            Math.ceil(object.open),
            Math.ceil(object.high),
            Math.ceil(object.low),
            Math.ceil(object.close),
            Math.ceil(object.volume),
            Math.ceil(object.atr14) || 0,
            Math.ceil(object.cci14) || 0,
            Math.ceil(object.mfi14) || 0,
            Math.ceil(object.rsi7) || 0,
            Math.ceil(object.rsi14) || 0,
            Math.ceil(object.ema7) || 0,
            Math.ceil(object.ema25) || 0,
            Math.ceil(object.ema99) || 0,
            Math.ceil(object.ema200) || 0,
            trendMap[object.trend] || 0,
            candlestickMap[object.candlestick] || 0
        ],
        output: [object.next]
    };
}

var lastAccuracy;
async function start() {
    if (!trainingData) {
        trainingData = (await Utils.readJSON("btcusdt")).map(mapCandle);
        trainingData.push(...(await Utils.readJSON("ethusdt")).map(mapCandle));
    }
    trainModelAndSave(model, totalIterations);
    let correct = 0;
    for (let i = 0; i < trainingData.length; i++) {
        let prediction = predict(model, trainingData[i].input);
        if (Math.round(prediction) === trainingData[i].output[0]) {
            correct += 1;
        }
    }
    let accuracy = correct / trainingData.length;
    console.log("Accuraccy", Utils.round(accuracy * 100) + "%");
    if (!lastAccuracy) {
        lastAccuracy = accuracy;
    }
    console.log("Improvement", accuracy - lastAccuracy);
    lastAccuracy = Number(accuracy);
    if (accuracy < 0.7) {
        return start();
    }
    console.log("You are a millionaire!");
    process.exit();
}
